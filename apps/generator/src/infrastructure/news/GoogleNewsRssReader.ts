import { XMLParser } from 'fast-xml-parser'
import type { NewsSourcePort, NewsItem } from '@socialshelf/domain'

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search'

interface GoogleNewsRssSource {
  '#text'?: string
  '@_url'?: string
}

interface GoogleNewsRssItem {
  title?: string
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
    const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(segment)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`
    const response = await fetch(url)

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
          sourceName,
          publishedAt: new Date(item.pubDate ?? ''),
        }
      })
      .filter((item): item is NewsItem => item !== null)
  }
}
