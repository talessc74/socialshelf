import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockBrandProfile = {
  id: 'profile-1',
  userId: 'brand-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: ['inteligência artificial'] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
  createdAt: new Date(),
}

const mockFindLatestByBrand = vi.fn().mockResolvedValue(mockBrandProfile)

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrand: mockFindLatestByBrand,
    findByBrandAndVersion: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreAudienceSignalRepository.js', () => ({
  FirestoreAudienceSignalRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrandAndPlatform: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreTopicSuggestionRepository.js', () => ({
  FirestoreTopicSuggestionRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findLatestByBrand: vi.fn().mockResolvedValue([]),
  })),
}))

const mockFetchNews = vi.fn().mockResolvedValue([
  {
    title: 'Inteligência artificial avança no setor',
    summary: 'Resumo',
    sourceUrl: 'https://www.reuters.com/article/1',
    articleUrl: 'https://news.google.com/rss/articles/abc',
    sourceName: 'Reuters',
    publishedAt: new Date('2026-06-01T00:00:00Z'),
  },
])

vi.mock('../infrastructure/news/GoogleNewsRssReader.js', () => ({
  GoogleNewsRssReader: vi.fn().mockImplementation(() => ({
    fetchNews: mockFetchNews,
  })),
}))

// Tradutor identidade e thumbnail nulo: o teste de integração não deve tocar Vertex AI nem a rede.
vi.mock('../infrastructure/vertexai/GeminiTranslator.js', () => ({
  GeminiTranslator: vi.fn().mockImplementation(() => ({
    translate: vi.fn(async ({ texts }: { texts: string[] }) => texts),
  })),
}))

vi.mock('../infrastructure/news/OgImageThumbnailFetcher.js', () => ({
  OgImageThumbnailFetcher: vi.fn().mockImplementation(() => ({
    fetchThumbnail: vi.fn(async () => null),
  })),
}))

describe('POST /pauta/suggest', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with topic suggestions', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pauta/suggest',
      payload: { brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ suggestions: Array<{ sourceDomain: string }> }>()
    expect(body.suggestions).toHaveLength(1)
    expect(body.suggestions[0]?.sourceDomain).toBe('reuters.com')
  })

  it('returns 400 when body is missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pauta/suggest',
      payload: {},
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when there is no brand profile', async () => {
    mockFindLatestByBrand.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'POST',
      url: '/pauta/suggest',
      payload: { brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 401 when INTERNAL_SECRET header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/pauta/suggest',
      payload: { brandId: 'brand-1' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('startup validation', () => {
  it('throws if INTERNAL_SECRET is not set', async () => {
    delete process.env['INTERNAL_SECRET']
    await expect(buildApp()).rejects.toThrow('INTERNAL_SECRET')
  })
})
