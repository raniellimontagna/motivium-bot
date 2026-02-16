import { Dayjs } from 'dayjs'

export interface NewsArticle {
  title: string
  summary: string
  contentSnippet: string
  content: string
  url: string
  publishedAt: Dayjs
  source: { name: string }
}

export interface NewsProvider {
  fetchNews(): Promise<NewsArticle[]>
}
