import type { NewsItem } from '../entities/NewsItem.js'

export interface NewsSourcePort {
  fetchNews(segment: string): Promise<NewsItem[]>
}
