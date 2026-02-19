import { Client } from 'discord.js'

import { NewsArticle } from '#services'

export enum NewsCategory {
  AI = 'AI',
  Tech = 'Tech',
  Space = 'Space',
  Economy = 'Economy',
  Brazil = 'Brazil',
  Agro = 'Agro',
  Gossip = 'Gossip',
}

interface ScheduleParams {
  client: Client
  category: NewsCategory
  getNewsFunction: () => Promise<NewsArticle[]>
}

export interface ScheduleNewsChannels extends ScheduleParams {
  channelIds: string[]
}

export interface ScheduleNewsMessage extends ScheduleParams {
  channelId: string
}
