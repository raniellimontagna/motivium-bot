import OpenAI from 'openai'
import { Message } from '@prisma/client'
import { AIProvider } from '../domain/AIProvider.js'
import { SYSTEM_INSTRUCTIONS } from '../system-instructions.js'

export class OpenAIProvider implements AIProvider {
  private openai: OpenAI
  public readonly name = 'ChatGPT'

  constructor(apiKey?: string) {
    this.openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY })
  }

  async getResponse(message: string, history: Message[]): Promise<string | null> {
    const formattedHistory = history.map((msg) => ({
      role: 'user' as const,
      content: `${msg.user}: ${msg.content}`,
    }))

    const completion = await this.openai.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTIONS },
        ...formattedHistory,
        { role: 'user', content: message },
      ],
      model: 'gpt-4o',
      max_tokens: 1024,
      temperature: 1,
    })

    return completion.choices[0]?.message?.content || null
  }
}
