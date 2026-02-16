import { logger, handleServiceError } from '#settings'
import { Message } from '@prisma/client'
import { AIProvider } from '../domain/AIProvider.js'
import { OpenAIProvider } from '../infrastructure/OpenAIProvider.js'
import { GeminiProvider } from '../infrastructure/GeminiProvider.js'

type AIResult =
  | { success: true; response: string }
  | { success: false; error: any; isQuotaError?: boolean; message?: string }

async function tryGetAIResponse(
  provider: AIProvider,
  message: string,
  history: Message[],
): Promise<AIResult> {
  try {
    const response = await provider.getResponse(message, history)
    if (response) {
      return { success: true, response } as const
    }
    return { success: false, error: new Error(`No response from ${provider.name}`) } as const
  } catch (error: any) {
    const isQuotaError =
      provider.name === 'ChatGPT' && (error?.error?.type === 'insufficient_quota' || error?.status === 429)
    return { success: false, error, isQuotaError } as const
  }
}

export async function getAIResponse(message: string, history: Message[]) {
  const openAIProvider = new OpenAIProvider()
  const geminiProvider = new GeminiProvider()

  // Try ChatGPT first
  const chatGPTResult = await tryGetAIResponse(openAIProvider, message, history)

  if (chatGPTResult.success) {
    return { success: true, response: chatGPTResult.response } as const
  }

  logger.error('Error getting ChatGPT response:', chatGPTResult.error)

  // Fallback to Gemini if ChatGPT fails (e.g. quota or other errors)
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('Gemini API key not configured, skipping fallback')
    return handleServiceError(chatGPTResult.error, 'AI Service (ChatGPT)')
  }

  logger.warn('ChatGPT failed, trying Gemini API')

  const geminiResult = await tryGetAIResponse(geminiProvider, message, history)

  if (geminiResult.success) {
    return { success: true, response: geminiResult.response } as const
  }

  logger.error('Error getting Gemini response:', geminiResult.error)
  return handleServiceError(geminiResult.error, 'AI Service (Gemini)')
}
