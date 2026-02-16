import dayjs, { Dayjs } from 'dayjs'
import Parser from 'rss-parser'

export interface NewsArticle {
  title: string
  summary: string
  contentSnippet: string
  content: string
  url: string
  publishedAt: Dayjs
  source: { name: string }
}

interface RSSFeed {
  url: string
  name: string
}

const parser = new Parser()

import { logger } from '#settings'

async function getRSSNews(feed: RSSFeed): Promise<NewsArticle[]> {
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

    // Return only articles published today to avoid old news
    return todayArticles
  } catch (error) {
    logger.error(`Error fetching RSS news from ${feed.name}:`, error)
    return []
  }
}

const theVergeURLBase = 'https://www.theverge.com/rss'
const investingURLBase = 'https://br.investing.com/rss'
const gazetaDoPovoUrlBase = 'https://www.gazetadopovo.com.br/feed/rss'
const conexaoPoliticaUrlBase = 'https://conexaopolitica.com.br/feed'
const embrapaAgroUrlBase =
  'https://www.embrapa.br/en/noticias-rss/-/asset_publisher/HA73uEmvroGS/rss'

/**
 * Factory function to create news fetcher functions
 */
function createNewsFetcher(feeds: RSSFeed[]) {
  return async () => {
    const news = await Promise.all(feeds.map((feed) => getRSSNews(feed)))
    return news.flat()
  }
}

export const getTechNews = createNewsFetcher([
  { url: `${theVergeURLBase}/tech/index.xml`, name: 'The Verge - Tech' },
])

export const getAINews = createNewsFetcher([
  { url: `${theVergeURLBase}/ai-artificial-intelligence/index.xml`, name: 'The Verge - AI' },
])

export const getSpaceNews = createNewsFetcher([
  { url: `${theVergeURLBase}/space/index.xml`, name: 'The Verge - Space' },
])

export const getEconomyNews = createNewsFetcher([
  { url: `${investingURLBase}/news_301.rss`, name: 'Investing.com - Cryptocurrency' },
  { url: `${investingURLBase}/news_14.rss`, name: 'Investing.com - Economy' },
  { url: `${investingURLBase}/news_1.rss`, name: 'Investing.com - Currency Exchange' },
  { url: `${gazetaDoPovoUrlBase}/economia.xml`, name: 'Gazeta do Povo - Economia' },
])

export const getBrazilNews = createNewsFetcher([
  { url: `${conexaoPoliticaUrlBase}`, name: 'Conexão Política - Política' },
  { url: `${gazetaDoPovoUrlBase}/republica.xml`, name: 'Gazeta do Povo - República' },
  { url: `${gazetaDoPovoUrlBase}/opiniao.xml`, name: 'Gazeta do Povo - Opinião' },
])

export const getAgroNews = createNewsFetcher([{ url: `${embrapaAgroUrlBase}`, name: 'Embrapa - Agro' }])

export { getRSSNews }
