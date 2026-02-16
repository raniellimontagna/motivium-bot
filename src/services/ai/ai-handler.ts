import { logger } from '#settings'

import { Message } from '@prisma/client'

import { getGeminiResponse } from './gemini.js'
import { getChatGPTResponse } from './openai.js'

type AIResult =
  | { success: true; response: string }
  | { success: false; error: any; isQuotaError?: boolean }

async function tryGetAIResponse(
  fetcher: () => Promise<string | null>,
  serviceName: string,
): Promise<AIResult> {
  try {
    const response = await fetcher()
    if (response) {
      return { success: true, response } as const
    }
    return { success: false, error: new Error(`No response from ${serviceName}`) } as const
  } catch (error: any) {
    const isQuotaError =
      serviceName === 'ChatGPT' && (error?.error?.type === 'insufficient_quota' || error?.status === 429)
    return { success: false, error, isQuotaError } as const
  }
}

export async function getAIResponse(message: string, history: Message[]) {
  // Try ChatGPT first
  const chatGPTResult = await tryGetAIResponse(
    () => getChatGPTResponse(message, history),
    'ChatGPT',
  )

  if (chatGPTResult.success) {
    return { success: true, response: chatGPTResult.response } as const
  }

  logger.error('Error getting ChatGPT response:', chatGPTResult.error)

  // Fallback to Gemini if ChatGPT fails (e.g. quota or other errors)
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('Gemini API key not configured, skipping fallback')
    return {
      success: false,
      error: chatGPTResult.error,
      message: 'Desculpe, o serviço de IA está temporariamente indisponível 😔',
    } as const
  }

  logger.warn('ChatGPT failed, trying Gemini API')

  const geminiResult = await tryGetAIResponse(() => getGeminiResponse(message, history), 'Gemini')

  if (geminiResult.success) {
    return { success: true, response: geminiResult.response } as const
  }

  logger.error('Error getting Gemini response:', geminiResult.error)
  return {
    success: false,
    error: geminiResult.error,
    message: 'Desculpe, não consegui encontrar uma resposta para isso 😔',
  } as const
}
