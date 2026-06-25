import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const mockFindByBrand = vi.fn().mockResolvedValue([])

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByBrand: mockFindByBrand,
    findScheduledBefore: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findLatestByBrand: vi.fn().mockResolvedValue(null),
    findByBrandAndVersion: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findByBrand: vi.fn().mockResolvedValue([]),
    findByBrandAndPlatform: vi.fn().mockResolvedValue(null),
    findById: vi.fn(),
    findByPairwise: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/secret-manager/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
    store: vi.fn(),
    retrieve: vi.fn(),
    delete: vi.fn(),
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('GET /pauta-suggestions', () => {
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

  it('proxies to generator and returns the topic suggestions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            id: 'suggestion-1',
            brandId: 'user-test-123',
            headline: 'Headline',
            summary: 'Summary',
            sourceUrl: 'https://www.reuters.com/article/1',
            sourceDomain: 'reuters.com',
            articleUrl: 'https://news.google.com/rss/articles/abc',
            rationale: 'Casa com os temas recorrentes',
            audienceFitScore: 1.1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/pauta-suggestions',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ suggestions: Array<{ sourceDomain: string }> }>()
    expect(body.suggestions[0]?.sourceDomain).toBe('reuters.com')
  })

  it('marca a sugestão com as plataformas em que já foi publicada', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            id: 'suggestion-1',
            brandId: 'user-test-123',
            headline: 'Headline',
            summary: 'Summary',
            sourceUrl: 'https://www.reuters.com/article/1',
            sourceDomain: 'reuters.com',
            articleUrl: 'https://news.google.com/rss/articles/abc',
            rationale: 'Casa com os temas recorrentes',
            audienceFitScore: 1.1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    })
    mockFindByBrand.mockResolvedValueOnce([
      {
        id: 'post-1',
        userId: 'user-test-123',
        brandId: 'user-test-123',
        content: [{ platform: 'instagram', text: 'Texto', charCount: 5 }],
        status: 'published',
        sourceArticleUrl: 'https://news.google.com/rss/articles/abc',
      },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/pauta-suggestions',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ suggestions: Array<{ publishedPlatforms: string[] }> }>()
    expect(body.suggestions[0]?.publishedPlatforms).toEqual(['instagram'])
  })

  it('returns 404 when generator returns 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })

    const response = await app.inject({
      method: 'GET',
      url: '/pauta-suggestions',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/pauta-suggestions',
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /pauta-search', () => {
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

  it('proxies the typed query to generator and returns the topic suggestions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [
          {
            id: 'suggestion-1',
            brandId: 'user-test-123',
            headline: 'Headline',
            summary: 'Summary',
            sourceUrl: 'https://www.reuters.com/article/1',
            sourceDomain: 'reuters.com',
            articleUrl: 'https://news.google.com/rss/articles/abc',
            rationale: 'Casa com os temas recorrentes',
            audienceFitScore: 1.1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/pauta-search',
      payload: { query: 'inteligência artificial no varejo' },
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ suggestions: Array<{ sourceDomain: string }> }>()
    expect(body.suggestions[0]?.sourceDomain).toBe('reuters.com')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3003/pauta/search',
      expect.objectContaining({
        body: JSON.stringify({ brandId: 'user-test-123', query: 'inteligência artificial no varejo' }),
      }),
    )
  })

  it('returns 400 when query is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pauta-search',
      payload: {},
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when generator returns 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })

    const response = await app.inject({
      method: 'POST',
      url: '/pauta-search',
      payload: { query: 'inteligência artificial' },
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pauta-search',
      payload: { query: 'inteligência artificial' },
    })

    expect(response.statusCode).toBe(401)
  })
})
