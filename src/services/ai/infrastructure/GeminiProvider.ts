import { GoogleGenerativeAI } from '@google/generative-ai'
import { Message } from '@prisma/client'
import { AIProvider } from '../domain/AIProvider.js'
import { SYSTEM_INSTRUCTIONS } from '../system-instructions.js'

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI
  public readonly name = 'Gemini'

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || '')
  }

  async getResponse(message: string, history: Message[]): Promise<string | null> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 1,
      },
    })

    const historyContext = history.map((msg) => `(${msg.user}): ${msg.content}`).join('\n')

    const fullPrompt = `${SYSTEM_INSTRUCTIONS}\n\nHistórico da conversa:\n${historyContext}\n\nMensagem do usuário: ${message}`

    const result = await model.generateContent(fullPrompt)
    return result.response.text() || null
  }
}
