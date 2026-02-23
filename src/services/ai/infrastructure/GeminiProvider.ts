import { GoogleGenAI } from '@google/genai'
import { Message } from '@prisma/client'
import { AIProvider } from '../domain/AIProvider.js'
import { SYSTEM_INSTRUCTIONS } from '../system-instructions.js'

export class GeminiProvider implements AIProvider {
  private client: any
  public readonly name = 'Gemini'

  constructor(apiKey?: string) {
    this.client = new GoogleGenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY || '',
    })
  }

  async getResponse(message: string, history: Message[]): Promise<string | null> {
    const historyContext = history.map((msg) => `(${msg.user}): ${msg.content}`).join('\n')
    const fullPrompt = `${SYSTEM_INSTRUCTIONS}\n\nHistórico da conversa:\n${historyContext}\n\nMensagem do usuário: ${message}`

    const result = await this.client.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: {
        maxOutputTokens: 1024,
        temperature: 1,
      },
    })

    return result.text || null
  }
}
