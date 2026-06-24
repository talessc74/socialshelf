import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoogleNewsRssReader } from './GoogleNewsRssReader.js'

function rssFeed(itemsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>"tecnologia" - Google News</title>
    ${itemsXml}
  </channel>
</rss>`
}

describe('GoogleNewsRssReader', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps items to NewsItem, using the source url attribute as sourceUrl', async () => {
    const reader = new GoogleNewsRssReader()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        rssFeed(`
          <item>
            <title>Manchete de teste - Reuters</title>
            <link>https://news.google.com/rss/articles/some-id</link>
            <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
            <description>&lt;a href="https://www.reuters.com/article/1"&gt;Resumo da notícia.&lt;/a&gt;</description>
            <source url="https://www.reuters.com">Reuters</source>
          </item>
        `),
    })

    const result = await reader.fetchNews('tecnologia')

    expect(result).toEqual([
      {
        title: 'Manchete de teste',
        summary: 'Resumo da notícia.',
        sourceUrl: 'https://www.reuters.com',
        articleUrl: 'https://news.google.com/rss/articles/some-id',
        sourceName: 'Reuters',
        publishedAt: new Date('Mon, 01 Jun 2026 12:00:00 GMT'),
      },
    ])
  })

  it('defaults summary to empty string when description is missing', async () => {
    const reader = new GoogleNewsRssReader()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        rssFeed(`
          <item>
            <title>Sem descrição - Reuters</title>
            <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
            <source url="https://www.reuters.com">Reuters</source>
          </item>
        `),
    })

    const result = await reader.fetchNews('tecnologia')

    expect(result[0]?.summary).toBe('')
  })

  it('discards items without a source url, since no trusted domain can be derived', async () => {
    const reader = new GoogleNewsRssReader()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        rssFeed(`
          <item>
            <title>Sem fonte rastreável</title>
            <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
          </item>
        `),
    })

    const result = await reader.fetchNews('tecnologia')

    expect(result).toEqual([])
  })

  it('includes the segment and global (en-US) locale params in the request', async () => {
    const reader = new GoogleNewsRssReader()
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => rssFeed('') })

    await reader.fetchNews('marketing digital')

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toContain('https://news.google.com/rss/search')
    expect(calledUrl).toContain(encodeURIComponent('marketing digital'))
    expect(calledUrl).toContain('hl=en-US')
    expect(calledUrl).toContain('gl=US')
  })

  it('falls back to the source root url as articleUrl when <link> is missing', async () => {
    const reader = new GoogleNewsRssReader()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        rssFeed(`
          <item>
            <title>Sem link de artigo - Reuters</title>
            <pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
            <source url="https://www.reuters.com">Reuters</source>
          </item>
        `),
    })

    const result = await reader.fetchNews('tecnologia')

    expect(result[0]?.articleUrl).toBe('https://www.reuters.com')
  })

  it('throws when Google News RSS returns an error', async () => {
    const reader = new GoogleNewsRssReader()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' })

    await expect(reader.fetchNews('tecnologia')).rejects.toThrow('Google News RSS fetch failed: 429 Rate limited')
  })

  it('sends a real browser user-agent, since Google blocks requests that look automated', async () => {
    const reader = new GoogleNewsRssReader()
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => rssFeed('') })

    await reader.fetchNews('tecnologia')

    const options = fetchMock.mock.calls[0]![1] as RequestInit
    const userAgent = (options.headers as Record<string, string>)['User-Agent']
    expect(userAgent).toMatch(/Mozilla/)
    // Uma UA que se autodeclara bot (ex.: "SocialShelfBot") é o próprio padrão que o Google bloqueia.
    expect(userAgent).not.toMatch(/bot/i)
  })

  it('aborts the request once it hangs past the timeout, instead of stalling forever', async () => {
    vi.useFakeTimers()
    const reader = new GoogleNewsRssReader()
    fetchMock.mockImplementationOnce(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
        }),
    )

    const promise = reader.fetchNews('tecnologia')
    const assertion = expect(promise).rejects.toThrow('AbortError')
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    vi.useRealTimers()
  })
})
