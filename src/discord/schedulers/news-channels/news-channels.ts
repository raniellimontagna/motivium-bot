import { Client } from 'discord.js'
import he from 'he'
import NodeCache from 'node-cache'

import { logger, parseEnvList } from '#settings'
import { sendMessage } from '#utils'
import {
  getAINews,
  getEconomyNews,
  getSpaceNews,
  getTechNews,
  getBrazilNews,
  getAgroNews,
  getGossipNews,
} from '#services'

import { NewsCategory, ScheduleNewsMessage } from './news-channels.types.js'

import { createScheduler } from '#discord'

// Set cache expiration time to 24 hours, with a check period of 1 hour
const newsCaches: Record<NewsCategory, NodeCache> = Object.values(NewsCategory).reduce(
  (acc, category) => {
    acc[category] = new NodeCache({ stdTTL: 86400, checkperiod: 3600 })
    return acc
  },
  {} as Record<NewsCategory, NodeCache>,
)

export async function triggerNewsChannels(client: Client) {
  const categories = [
    { env: 'AI_NEWS_CHANNELS_IDS', fetchNews: getAINews, name: NewsCategory.AI },
    { env: 'AGRO_NEWS_CHANNELS_IDS', fetchNews: getAgroNews, name: NewsCategory.Agro },
    { env: 'TECH_NEWS_CHANNELS_IDS', fetchNews: getTechNews, name: NewsCategory.Tech },
    { env: 'SPACE_NEWS_CHANNELS_IDS', fetchNews: getSpaceNews, name: NewsCategory.Space },
    { env: 'BRAZIL_NEWS_CHANNELS_IDS', fetchNews: getBrazilNews, name: NewsCategory.Brazil },
    { env: 'ECONOMY_NEWS_CHANNELS_IDS', fetchNews: getEconomyNews, name: NewsCategory.Economy },
    { env: 'GOSSIP_NEWS_CHANNELS_IDS', fetchNews: getGossipNews, name: NewsCategory.Gossip },
  ]

  for (const { env, fetchNews, name } of categories) {
    const channelIds = parseEnvList(process.env[env])

    if (!channelIds.length) continue

    for (const channelId of channelIds) {
      await scheduleNewsMessage({ client, category: name, channelId, getNewsFunction: fetchNews })
    }
  }
}

createScheduler({
  name: 'News channels',
  cron: '0,30 * * * *', // Every 30 minutes
  async run(client) {
    await triggerNewsChannels(client)
  },
})

async function scheduleNewsMessage({
  client,
  category,
  channelId,
  getNewsFunction,
}: ScheduleNewsMessage) {
  try {
    const articles = await getNewsFunction()

    if (!articles.length) {
      logger.warn('No news articles found')
      return
    }

    const newArticles = articles.filter(
      (article) => !newsCaches[category as NewsCategory].has(article.url),
    )

    if (newArticles.length === 0) {
      logger.warn('No new news articles available')
      return
    }

    const article = newArticles[0]
    newsCaches[category as NewsCategory].set(article.url, true)

    const image = article.content.match(/<img[^>]+src="([^"]+)"/)?.[1].split('?')[0] ?? ''

    const sourceFormatted = `-# 🗞️ Fonte: [${article.source.name}](<${article.url}>)`
    const publishedAtDate = article.publishedAt.format('DD/MM/YYYY [às] HH:mm')

    const rawSummary = article.summary
    const cleanSummary = he.decode(rawSummary)

    const message = `${cleanSummary}\n\n${sourceFormatted} • ${publishedAtDate}`

    sendMessage({
      client,
      channelId,
      imageUrl: image,
      title: `📰 ${article.title}`,
      message,
    })
  } catch (error) {
    logger.error(`Error sending news message to channel ${channelId}:`, error)
  }
}
