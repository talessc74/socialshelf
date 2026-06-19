import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NewsApiOrgReader } from './NewsApiOrgReader.js'

describe('NewsApiOrgReader', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps articles to NewsItem', async () => {
    const reader = new NewsApiOrgReader('test-api-key')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: [
          {
            title: 'Breaking news',
            description: 'A summary',
            url: 'https://www.reuters.com/article/1',
            source: { name: 'Reuters' },
            publishedAt: '2026-06-01T12:00:00Z',
          },
        ],
      }),
    })

    const result = await reader.fetchNews('tecnologia')

    expect(result).toEqual([
      {
        title: 'Breaking news',
        summary: 'A summary',
        sourceUrl: 'https://www.reuters.com/article/1',
        sourceName: 'Reuters',
        publishedAt: new Date('2026-06-01T12:00:00Z'),
      },
    ])
  })

  it('defaults summary to empty string when description is null', async () => {
    const reader = new NewsApiOrgReader('test-api-key')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: [
          {
            title: 'No description',
            description: null,
            url: 'https://www.reuters.com/article/2',
            source: { name: 'Reuters' },
            publishedAt: '2026-06-01T12:00:00Z',
          },
        ],
      }),
    })

    const result = await reader.fetchNews('tecnologia')

    expect(result[0]?.summary).toBe('')
  })

  it('includes the segment as a query param', async () => {
    const reader = new NewsApiOrgReader('test-api-key')
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ articles: [] }) })

    await reader.fetchNews('marketing digital')

    const calledUrl = fetchMock.mock.calls[0]![0] as string
    expect(calledUrl).toContain(encodeURIComponent('marketing digital'))
    expect(calledUrl).toContain('apiKey=test-api-key')
  })

  it('throws when the News API returns an error', async () => {
    const reader = new NewsApiOrgReader('test-api-key')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' })

    await expect(reader.fetchNews('tecnologia')).rejects.toThrow('News API fetch failed: 429 Rate limited')
  })
})
