import { Message } from '@prisma/client'

export interface AIProvider {
  name: string
  getResponse(message: string, history: Message[]): Promise<string | null>
}
