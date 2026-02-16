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
    const userMessage = chatGPTResult.isQuotaError 
      ? 'O serviço de IA atingiu o limite de uso diário. Por favor, tente novamente mais tarde. 😔'
      : 'O serviço de IA está temporariamente indisponível. Por favor, tente mais tarde. 😔'
      
    return handleServiceError(chatGPTResult.error, 'AI Service (ChatGPT)', userMessage)
  }

  logger.warn('ChatGPT failed, trying Gemini API')

  const geminiResult = await tryGetAIResponse(geminiProvider, message, history)

  if (geminiResult.success) {
    return { success: true, response: geminiResult.response } as const
  }

  logger.error('Error getting Gemini response:', geminiResult.error)
  
  const isGeminiQuota = geminiResult.error?.status === 429 || 
    (typeof geminiResult.error?.message === 'string' && geminiResult.error.message.includes('quota'))

  const userMessage = isGeminiQuota
    ? 'O sistema de IA atingiu o limite máximo de requisições. Por favor, tente novamente em alguns instantes. 😔'
    : 'Desculpe, não consegui processar sua mensagem no momento. Por favor, tente novamente mais tarde. 😔'

  return handleServiceError(geminiResult.error, 'AI Service (Gemini)', userMessage)
}
