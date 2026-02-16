import { Client } from 'discord.js'
import { createScheduler } from '#discord'
import { PromotionsService } from './promotions.service.js'

let promotionsService: PromotionsService | null = null

createScheduler({
  name: 'Promotions',
  cron: '*/5 * * * *', // Every 5 minutes (default search interval)
  run(client: Client) {
    if (!promotionsService) {
      promotionsService = new PromotionsService(client)
      promotionsService.initialize()
    }
  },
})

/**
 * Get the instance of the promotions service
 */
export function getPromotionsService(): PromotionsService | null {
  return promotionsService
}

export { PromotionsService }
export * from './promotions.types.js'
