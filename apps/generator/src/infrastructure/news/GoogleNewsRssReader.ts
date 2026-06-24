import { XMLParser } from 'fast-xml-parser'
import type { NewsSourcePort, NewsItem } from '@socialshelf/domain'

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search'
const TIMEOUT_MS = 8000

interface GoogleNewsRssSource {
  '#text'?: string
  '@_url'?: string
}

interface GoogleNewsRssItem {
  title?: string
  link?: string
  description?: string
  pubDate?: string
  source?: GoogleNewsRssSource
}

interface GoogleNewsRssFeed {
  rss?: {
    channel?: {
      item?: GoogleNewsRssItem[]
    }
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === 'item',
})

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripSourceSuffix(title: string, sourceName: string): string {
  const suffix = ` - ${sourceName}`
  return sourceName && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}

export class GoogleNewsRssReader implements NewsSourcePort {
  async fetchNews(segment: string): Promise<NewsItem[]> {
    // Busca global em inglês: o Google Notícias devolve veículos internacionais de credibilidade
    // (Reuters, AP, BBC, TechCrunch…) que casam com a allowlist de fontes confiáveis. A tradução
    // para o idioma do usuário acontece depois, no SuggestTopicsUseCase.
    const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(segment)}&hl=en-US&gl=US&ceid=US:en`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(url, {
        signal: controller.signal,
        // Precisa ser uma UA de navegador real: uma UA que se autodeclara bot (ex.: "...Bot/1.0...")
        // é exatamente o padrão que o anti-scraping do Google bloqueia, mesmo formatada como Mozilla/5.0.
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Google News RSS fetch failed: ${response.status} ${err}`)
    }

    const xml = await response.text()
    const feed = parser.parse(xml) as GoogleNewsRssFeed
    const items = feed.rss?.channel?.item ?? []

    return items
      .map((item) => {
        const sourceUrl = item.source?.['@_url']
        if (!sourceUrl) return null

        const sourceName = item.source?.['#text'] ?? ''
        return {
          title: stripSourceSuffix(item.title ?? '', sourceName),
          summary: item.description ? stripHtml(item.description) : '',
          sourceUrl,
          // O <link> do Google News é um redirect para o artigo; usamos como melhor esforço para o
          // thumbnail. Quando ausente, caímos na raiz do veículo (sourceUrl).
          articleUrl: item.link ?? sourceUrl,
          sourceName,
          publishedAt: new Date(item.pubDate ?? ''),
        }
      })
      .filter((item): item is NewsItem => item !== null)
  }
}
