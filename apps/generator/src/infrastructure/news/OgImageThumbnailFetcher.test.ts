import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OgImageThumbnailFetcher } from './OgImageThumbnailFetcher.js'

function htmlWith(meta: string): string {
  return `<!doctype html><html><head><title>x</title>${meta}</head><body>...</body></html>`
}

describe('OgImageThumbnailFetcher', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts og:image from the article page', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.reuters.com/article/1',
      text: async () => htmlWith('<meta property="og:image" content="https://cdn.reuters.com/cover.jpg" />'),
    })

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://news.google.com/x', 'https://www.reuters.com')

    expect(result).toBe('https://cdn.reuters.com/cover.jpg')
  })

  it('upgrades http image urls to https to avoid mixed content', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.reuters.com/article/1',
      text: async () => htmlWith('<meta property="og:image" content="http://cdn.reuters.com/cover.jpg" />'),
    })

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://news.google.com/x')

    expect(result).toBe('https://cdn.reuters.com/cover.jpg')
  })

  it('resolves relative og:image urls against the page url', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.reuters.com/article/1',
      text: async () => htmlWith('<meta property="og:image" content="/img/cover.jpg" />'),
    })

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://www.reuters.com/article/1')

    expect(result).toBe('https://www.reuters.com/img/cover.jpg')
  })

  it('falls back to twitter:image when og:image is absent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.reuters.com/article/1',
      text: async () => htmlWith('<meta name="twitter:image" content="https://cdn.reuters.com/tw.jpg" />'),
    })

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://www.reuters.com/article/1')

    expect(result).toBe('https://cdn.reuters.com/tw.jpg')
  })

  it('tries the fallback url when the article fetch yields no image', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, url: 'https://news.google.com/x', text: async () => htmlWith('') })
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://www.reuters.com',
        text: async () => htmlWith('<meta property="og:image" content="https://cdn.reuters.com/home.jpg" />'),
      })

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://news.google.com/x', 'https://www.reuters.com')

    expect(result).toBe('https://cdn.reuters.com/home.jpg')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null (never throws) when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://news.google.com/x')

    expect(result).toBeNull()
  })

  it('returns null when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, url: 'https://x', text: async () => '' })

    const result = await new OgImageThumbnailFetcher().fetchThumbnail('https://x')

    expect(result).toBeNull()
  })
})
