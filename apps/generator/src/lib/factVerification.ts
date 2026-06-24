import type { NewsItem, VerifiedNewsItem } from '@socialshelf/domain'

// Veículos internacionais de credibilidade reconhecida. A busca de notícia é global/inglês, então
// estas fontes efetivamente aparecem nos resultados; a manchete é traduzida depois para o usuário.
// Sobrescrevível por TRUSTED_NEWS_DOMAINS.
const DEFAULT_TRUSTED_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'theguardian.com',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'ft.com',
  'bloomberg.com',
  'cnbc.com',
  'cnn.com',
  'forbes.com',
  'businessinsider.com',
  'axios.com',
  'npr.org',
  'economist.com',
  'aljazeera.com',
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'arstechnica.com',
  'engadget.com',
]

export function getTrustedDomains(): string[] {
  const env = process.env['TRUSTED_NEWS_DOMAINS']
  if (!env) return DEFAULT_TRUSTED_DOMAINS
  return env
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain.length > 0)
}

function extractDomain(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl)
    if (url.protocol !== 'https:') return null
    return url.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

export function verifyNewsItem(item: NewsItem, trustedDomains: string[]): VerifiedNewsItem | null {
  const domain = extractDomain(item.sourceUrl)
  if (!domain) return null

  const isTrusted = trustedDomains.some(
    (trusted) => domain === trusted || domain.endsWith(`.${trusted}`),
  )
  if (!isTrusted) return null

  return { ...item, sourceDomain: domain, verifiedAt: new Date() }
}
