import dayjs from 'dayjs'
import Parser from 'rss-parser'
import { logger } from '#settings'
import { NewsArticle, NewsProvider } from '../domain/NewsProvider.js'

export interface RSSFeed {
  url: string
  name: string
}

const parser = new Parser()

export class RSSNewsProvider implements NewsProvider {
  constructor(private feeds: RSSFeed[]) {}

  async fetchNews(): Promise<NewsArticle[]> {
    try {
      const news = await Promise.all(this.feeds.map((feed) => this.getRSSNews(feed)))
      return news.flat()
    } catch (error) {
      logger.error('Error in RSSNewsProvider fetchNews:', error)
      return []
    }
  }

  private async getRSSNews(feed: RSSFeed): Promise<NewsArticle[]> {
    try {
      const articles: NewsArticle[] = []
      const feedContent = await parser.parseURL(feed.url)

      for (const item of feedContent.items) {
        articles.push({
          title: item.title || '',
          contentSnippet: item.contentSnippet || '',
          content: item.content || '',
          summary: item.summary || '',
          url: item.link || '',
          publishedAt: item.pubDate ? dayjs(item.pubDate) : dayjs(),
          source: { name: feed.name },
        })
      }

      const sortedArticles = articles.sort((a, b) => b.publishedAt.diff(a.publishedAt))
      const todayArticles = sortedArticles.filter((a) => a.publishedAt.isSame(dayjs(), 'day'))

      return todayArticles
    } catch (error) {
      logger.error(`Error fetching RSS news from ${feed.name}:`, error)
      return []
    }
  }
}
