import type { NewsItem, VerifiedNewsItem } from '@socialshelf/domain'

// Veículos internacionais de credibilidade reconhecida. A busca de notícia é global/inglês, então
// estas fontes efetivamente aparecem nos resultados; a manchete é traduzida depois para o usuário.
// Sobrescrevível por TRUSTED_NEWS_DOMAINS.
const DEFAULT_TRUSTED_DOMAINS = [
  // Agências e generalistas
  'reuters.com',
  'apnews.com',
  'afp.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'nytimes.com',
  'washingtonpost.com',
  'usatoday.com',
  'latimes.com',
  'independent.co.uk',
  'telegraph.co.uk',
  'news.sky.com',
  'abcnews.go.com',
  'cbsnews.com',
  'nbcnews.com',
  'pbs.org',
  'npr.org',
  // Internacional / fora dos EUA-Reino Unido
  'aljazeera.com',
  'dw.com',
  'france24.com',
  'euronews.com',
  'scmp.com',
  'japantimes.co.jp',
  'abc.net.au',
  'cbc.ca',
  // Negócios e economia
  'wsj.com',
  'ft.com',
  'bloomberg.com',
  'cnbc.com',
  'cnn.com',
  'forbes.com',
  'fortune.com',
  'businessinsider.com',
  'axios.com',
  'economist.com',
  'politico.com',
  // Revistas e opinião
  'time.com',
  'newsweek.com',
  'vox.com',
  'propublica.org',
  // Tecnologia
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'arstechnica.com',
  'engadget.com',
  // Ciência
  'nature.com',
  'science.org',
  'scientificamerican.com',
  'newscientist.com',
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
