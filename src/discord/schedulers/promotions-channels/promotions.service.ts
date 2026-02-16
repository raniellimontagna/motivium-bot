import cron from 'node-cron'
import { Client, TextChannel, AttachmentBuilder, EmbedBuilder, Colors } from 'discord.js'

import { logger, parseEnvList } from '#settings'
import { sendMessage } from '#utils'
import { TelegramService } from '#services'

import {
  PromotionCategory,
  PROMOTION_KEYWORDS,
  SMART_KEYWORDS,
  DEFAULT_PROMOTION_CONFIG,
  CATEGORY_SPECIFIC_CONFIG,
  CATEGORY_METADATA,
  type PromotionConfig,
} from './promotions.types.js'
import type { TelegramMessage } from '../../../services/telegram/telegramService.types.js'
import type { PromotionQueueManager, PromotionCacheManager } from './domain/interfaces.js'
import {
  InMemoryPromotionQueueManager,
  CacheBasedPromotionCacheManager,
} from './infrastructure/repositories.js'
import { FetchPromotionsUseCase } from './usecases/fetchPromotions.js'

// Singleton for TelegramService to reuse connection
function getTelegramService(): TelegramService {
  return TelegramService.getInstance({
    apiId: Number(process.env.TELEGRAM_API_ID),
    apiHash: process.env.TELEGRAM_API_HASH!,
    phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
    password: process.env.TELEGRAM_PASSWORD,
    sessionString: process.env.TELEGRAM_SESSION_STRING,
  })
}

export class PromotionsService {
  private client: Client
  private promotionConfigs: Map<PromotionCategory, PromotionConfig> = new Map()
  private queueManager: PromotionQueueManager
  private cacheManager: PromotionCacheManager
  private fetchPromotionsUseCase: FetchPromotionsUseCase

  constructor(
    client: Client,
    queueManager?: PromotionQueueManager,
    cacheManager?: PromotionCacheManager,
  ) {
    this.client = client
    this.queueManager = queueManager || new InMemoryPromotionQueueManager()
    this.cacheManager = cacheManager || new CacheBasedPromotionCacheManager()
    this.fetchPromotionsUseCase = new FetchPromotionsUseCase(
      getTelegramService(),
      this.queueManager,
      this.cacheManager,
      SMART_KEYWORDS,
    )
    this.initialize()
  }

  /**
   * Initialize schedulers for all configured categories
   */
  initialize(): void {
    // Check if promotions are enabled via environment variable
    const promotionsEnabled = process.env.PROMOTIONS_ENABLED !== 'false'

    if (!promotionsEnabled) {
      logger.warn('🚫 Promotions system is DISABLED via PROMOTIONS_ENABLED environment variable')
      return
    }

    this.loadPromotionConfigurations()
    this.setupSchedulers()

    const configuredCategories = Array.from(this.promotionConfigs.keys())
    logger.success(`Promotions system initialized for: ${configuredCategories.join(', ')}`)
  }

  /**
   * Load configurations for the promotion categories from environment variables
   */
  private loadPromotionConfigurations(): void {
    for (const category of Object.values(PromotionCategory)) {
      const meta = CATEGORY_METADATA[category]
      this.addPromotionConfig({
        category,
        discordChannelIds: parseEnvList(process.env[meta.discordEnv]),
        telegramChannels: parseEnvList(process.env[meta.telegramEnv]),
      })
    }
  }

  private addPromotionConfig({
    category,
    discordChannelIds,
    telegramChannels,
  }: {
    category: PromotionCategory
    discordChannelIds: string[]
    telegramChannels: string[]
  }): void {
    if (!discordChannelIds.length || !telegramChannels.length) return

    this.promotionConfigs.set(category, {
      ...DEFAULT_PROMOTION_CONFIG,
      ...CATEGORY_SPECIFIC_CONFIG[category],
      category,
      discordChannelIds,
      telegramChannels,
      keywords: [...PROMOTION_KEYWORDS[category]],
    })
  }

  /**
   * Setup schedulers for each category
   */
  private setupSchedulers(): void {
    if (this.promotionConfigs.size === 0) {
      logger.warn('⚠️ No promotion configurations found! Check your environment variables.')
      return
    }

    for (const [category, config] of this.promotionConfigs) {
      cron.schedule(
        config.schedulePattern,
        async () => {
          try {
            await this.processPromotions(config)
          } catch (error) {
            logger.error(`Error processing ${category} promotions:`, error)
          }
        },
        {
          timezone: 'America/Sao_Paulo',
          name: `promotions-${category.toLowerCase()}`,
        },
      )
    }
  }

  /**
   * Process promotions for a specific category
   */
  private async processPromotions(config: PromotionConfig): Promise<void> {
    // Double-check if promotions are still enabled (safety check)
    const promotionsEnabled = process.env.PROMOTIONS_ENABLED !== 'false'
    if (!promotionsEnabled) {
      return // Silently skip processing if disabled
    }

    const { category, discordChannelIds, telegramChannels, keywords, maxPromotionsPerExecution } =
      config

    try {
      // Fetch new promotions if the queue is empty
      const queueSize = this.queueManager.getQueueSize(category)
      if (queueSize === 0) {
        await this.fetchPromotionsForCategory(category, telegramChannels, keywords)
      }

      const currentQueueSize = this.queueManager.getQueueSize(category)
      if (currentQueueSize === 0) {
        logger.warn(`▲ No promotions available for ${category}`)
        return
      }

      // Process one channel at a time to avoid spam
      for (const channelId of discordChannelIds) {
        const promotionsToSend = this.queueManager.getNext(category, maxPromotionsPerExecution)

        if (promotionsToSend.length === 0) break

        for (const promotion of promotionsToSend) {
          await this.sendPromotionToChannel(channelId, promotion, category)

          // Delay between messages
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }
    } catch (error) {
      logger.error(`❌ Error in ${category} promotions processing:`, error)
    }
  }

  /**
   * Fetch new promotions for a specific category
   */
  private async fetchPromotionsForCategory(
    category: PromotionCategory,
    telegramChannels: string[],
    keywords: string[],
  ): Promise<void> {
    try {
      // Get category-specific age limit
      const categoryConfig = CATEGORY_SPECIFIC_CONFIG[category]
      const maxAgeMinutes = categoryConfig?.maxAgeMinutes || DEFAULT_PROMOTION_CONFIG.maxAgeMinutes

      const criteria = {
        category,
        channels: telegramChannels,
        keywords,
        maxAgeMinutes: maxAgeMinutes || 5,
        limit: 20,
      }

      await this.fetchPromotionsUseCase.execute(criteria)
    } catch (error) {
      logger.error(`❌ Error fetching ${category} promotions:`, error)
    }
  }

  /**
   * Send a promotion to a specific channel
   */
  private async sendPromotionToChannel(
    channelId: string,
    promotion: TelegramMessage,
    category: PromotionCategory,
  ): Promise<void> {
    try {
      const { emoji, name: categoryName } = CATEGORY_METADATA[category]

      // Prepare message content
      const cleanMessage = promotion.message ? promotion.message.substring(0, 1800) : ''
      const sourceFormatted = `-# 📢 Canal: ${promotion.channel.replace('@', '')}`
      const dateFormatted = new Date(promotion.date * 1000).toLocaleString('pt-BR')

      const message = `${cleanMessage}\n\n${sourceFormatted} • ${dateFormatted}`

      // Try to send with image if available
      await this.sendPromotionWithMedia(channelId, promotion, emoji, categoryName, message)
    } catch (error) {
      logger.error(`Error sending ${category} promotion to channel ${channelId}:`, error)
    }
  }

  /**
   * Send promotion with media attachment if available
   */
  private async sendPromotionWithMedia(
    channelId: string,
    promotion: TelegramMessage,
    emoji: string,
    categoryName: string,
    message: string,
  ): Promise<void> {
    try {
      // First try to send with image if it's a photo
      if (promotion.media?.type === 'photo') {
        const success = await this.sendPromotionWithImage(
          channelId,
          promotion,
          emoji,
          categoryName,
          message,
        )
        if (success) return
      }

      // Fallback to regular message with media indicator
      let mediaInfo = ''
      if (promotion.media) {
        const mediaType =
          promotion.media.type === 'photo'
            ? '📸'
            : promotion.media.type === 'video'
              ? '🎥'
              : promotion.media.type === 'document'
                ? '📄'
                : '📎'
        mediaInfo = `${mediaType} *Contém mídia (${promotion.media.type})*\n`
      }

      const finalMessage = promotion.message
        ? `${message}\n\n${mediaInfo}`
        : `${mediaInfo}${message}`

      await sendMessage({
        client: this.client,
        channelId,
        title: `${emoji} Nova Promoção ${categoryName}!`,
        message: finalMessage,
      })
    } catch (error) {
      logger.error('Error sending promotion with media:', error)
    }
  }

  /**
   * Send promotion with downloaded Telegram image
   */
  private async sendPromotionWithImage(
    channelId: string,
    promotion: TelegramMessage,
    emoji: string,
    categoryName: string,
    message: string,
  ): Promise<boolean> {
    try {
      if (!promotion.originalMessage) {
        logger.warn('No original message available for media download')
        return false
      }

      const telegramService = getTelegramService()
      const mediaData = await telegramService.downloadMediaForDiscord(promotion.originalMessage)

      if (!mediaData) {
        logger.warn('Failed to download media from Telegram')
        return false
      }

      // Send using Discord with attachment
      await this.sendDiscordMessageWithAttachment(
        channelId,
        `${emoji} Nova Promoção ${categoryName}!`,
        message,
        mediaData.buffer,
        mediaData.filename,
      )

      return true
    } catch (error) {
      logger.error('Error sending promotion with image:', error)
      return false
    }
  }

  /**
   * Send Discord message with file attachment
   */
  private async sendDiscordMessageWithAttachment(
    channelId: string,
    title: string,
    message: string,
    buffer: Buffer,
    filename: string,
  ): Promise<void> {
    try {
      const channel = this.client.channels.cache.get(channelId) as TextChannel

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not text-based`)
      }

      const attachment = new AttachmentBuilder(buffer, { name: filename })

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setImage(`attachment://${filename}`)
        .setColor(Colors.Blue)

      await channel.send({
        embeds: [embed],
        files: [attachment],
      })
    } catch (error) {
      logger.error('Error sending Discord message with attachment:', error)
      throw error
    }
  }

  /**
   * Get statistics from the queues by category
   */
  getQueueStats(): Record<PromotionCategory, number> {
    const stats: Record<PromotionCategory, number> = {} as any

    for (const category of Object.values(PromotionCategory)) {
      stats[category] = this.queueManager.getQueueSize(category)
    }

    return stats
  }
}
