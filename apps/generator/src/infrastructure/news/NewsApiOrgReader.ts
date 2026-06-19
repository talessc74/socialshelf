import type { NewsSourcePort, NewsItem } from '@socialshelf/domain'

const NEWS_API = 'https://newsapi.org/v2/everything'

interface NewsApiArticle {
  title: string
  description: string | null
  url: string
  source: { name: string }
  publishedAt: string
}

interface NewsApiResponse {
  articles: NewsApiArticle[]
}

export class NewsApiOrgReader implements NewsSourcePort {
  constructor(private readonly apiKey: string) {}

  async fetchNews(segment: string): Promise<NewsItem[]> {
    const url = `${NEWS_API}?q=${encodeURIComponent(segment)}&language=pt&sortBy=publishedAt&apiKey=${this.apiKey}`
    const response = await fetch(url)

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`News API fetch failed: ${response.status} ${err}`)
    }

    const data = (await response.json()) as NewsApiResponse

    return data.articles.map((article) => ({
      title: article.title,
      summary: article.description ?? '',
      sourceUrl: article.url,
      sourceName: article.source.name,
      publishedAt: new Date(article.publishedAt),
    }))
  }
}
