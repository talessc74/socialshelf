import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const validEntry = {
  platform: 'instagram',
  text: 'Post de teste',
  metrics: { impressions: 100, likes: 10, comments: 2, shares: 1 },
  score: 113,
}

describe('Performance insights routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('POST /performance-insights', () => {
    it('sends the entries received from the client straight to the generator, without calling the publisher', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ insights: { niche: 'test' } }),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/performance-insights',
        headers: { authorization: 'Bearer valid-token' },
        payload: { entries: [validEntry] },
      })

      expect(response.statusCode).toBe(200)
      // Only one downstream call — no round-trip to the publisher for /posts-performance.
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]!
      expect(url).toBe('http://localhost:3003/performance-insights/analyze')
      expect(JSON.parse(init.body).entries).toEqual([validEntry])
    })

    it('rejects a malformed entries payload with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/performance-insights',
        headers: { authorization: 'Bearer valid-token' },
        payload: { entries: [{ platform: 'instagram' }] },
      })

      expect(response.statusCode).toBe(400)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('maps the generator "no data" 400 to the same error shape', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'No published posts with metrics to analyze' }),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/performance-insights',
        headers: { authorization: 'Bearer valid-token' },
        payload: { entries: [validEntry] },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({ error: 'No published posts with metrics to analyze' })
    })

    it('requires authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/performance-insights',
        payload: { entries: [validEntry] },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /performance-insights/latest', () => {
    it('proxies to the generator without touching the publisher', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ record: null }) })

      const response = await app.inject({
        method: 'GET',
        url: '/performance-insights/latest',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch.mock.calls[0]![0]).toContain('/performance-insights/latest')
    })
  })
})
