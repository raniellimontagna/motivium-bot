import axios from 'axios'
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
      const response = await axios.get(feed.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      })

      const rawContent = response.data
      if (typeof rawContent !== 'string') {
        throw new Error(`Expected string response from ${feed.name}, but got ${typeof rawContent}`)
      }

      // Clean content: remove everything before the first '<'
      const startTagIndex = rawContent.indexOf('<')
      const content = startTagIndex !== -1 ? rawContent.substring(startTagIndex).trim() : rawContent

      const articles: NewsArticle[] = []
      let feedContent
      try {
        feedContent = await parser.parseString(content)
      } catch (parseError) {
        logger.error(`Failed to parse XML from ${feed.name}. First 100 chars: ${content.substring(0, 100)}`)
        throw parseError
      }

      for (const item of feedContent.items) {
        articles.push({
          title: item.title?.trim() || '',
          contentSnippet: item.contentSnippet?.trim() || '',
          content: item.content?.trim() || '',
          summary: item.summary?.trim() || '',
          url: item.link?.trim() || '',
          publishedAt: item.pubDate ? dayjs(item.pubDate) : dayjs(),
          source: { name: feed.name },
          raw: item,
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
