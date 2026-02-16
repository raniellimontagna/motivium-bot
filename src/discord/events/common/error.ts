import { createEvent } from '#discord'
import { logger } from '#settings'

createEvent({
  name: 'Error handler',
  event: 'error',
  async run(error) {
    logger.error(error)
  },
})
