import type { ThumbnailFetcherPort } from '@socialshelf/domain'

const TIMEOUT_MS = 4000
// Lê apenas o começo do HTML: as meta tags og:/twitter: ficam no <head>, então não baixamos a
// página inteira (alguns artigos têm centenas de KB de corpo).
const MAX_HTML_BYTES = 200_000

export class OgImageThumbnailFetcher implements ThumbnailFetcherPort {
  async fetchThumbnail(articleUrl: string, fallbackUrl?: string): Promise<string | null> {
    const fromArticle = await this.tryFetch(articleUrl)
    if (fromArticle) return fromArticle
    if (fallbackUrl && fallbackUrl !== articleUrl) return this.tryFetch(fallbackUrl)
    return null
  }

  private async tryFetch(url: string): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        // UA de navegador real: alguns veículos servem HTML mínimo (ou bloqueiam) para clientes sem
        // UA — e uma UA que se autodeclara bot (ex.: "...Bot/1.0...") sofre o mesmo bloqueio.
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      })
      if (!response.ok) return null

      const html = (await response.text()).slice(0, MAX_HTML_BYTES)
      const image = this.extractOgImage(html)
      if (!image) return null

      return this.toAbsoluteHttps(image, response.url || url)
    } catch {
      // Timeout, DNS, TLS, redirect para página de consentimento etc. — thumbnail é melhor esforço.
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private extractOgImage(html: string): string | null {
    const patterns = [
      /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) return match[1].trim()
    }
    return null
  }

  private toAbsoluteHttps(image: string, base: string): string | null {
    try {
      const url = new URL(image, base)
      // Sobe http→https para evitar mixed content quando exibido no app (servido por https).
      if (url.protocol === 'http:') url.protocol = 'https:'
      if (url.protocol !== 'https:') return null
      return url.toString()
    } catch {
      return null
    }
  }
}
