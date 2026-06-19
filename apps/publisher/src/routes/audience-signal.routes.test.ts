import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockPost = {
  id: 'post-1',
  userId: 'user-1',
  brandId: 'brand-1',
  brandProfileVersion: null,
  content: [{ platform: 'linkedin', text: 'Hello!', charCount: 6 }],
  imageStoragePaths: [],
  status: 'published',
  scheduledAt: null,
  publishedAt: new Date(),
  externalIds: { linkedin: 'urn:li:share:1' },
  createdAt: new Date(),
  updatedAt: new Date(),
}

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    findByIdAndBrand: vi.fn(),
    save: vi.fn(),
    findByBrand: vi.fn().mockResolvedValue([mockPost]),
    findScheduledBefore: vi.fn(),
    delete: vi.fn(),
  })),
}))

const mockFindByBrandAndPlatform = vi.fn().mockResolvedValue({
  id: 'conn-1',
  userId: 'user-1',
  brandId: 'brand-1',
  platform: 'linkedin',
  pairwiseId: 'pairwise-li',
  tokenRef: 'token-ref-li',
  scopes: [],
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
})

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    findByBrandAndPlatform: mockFindByBrandAndPlatform,
    save: vi.fn(),
    findById: vi.fn(),
    findByPairwise: vi.fn(),
    findByBrand: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreAudienceSignalRepository.js', () => ({
  FirestoreAudienceSignalRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findLatestByBrandAndPlatform: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue(JSON.stringify({ access_token: 'li-token' })),
    store: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/analytics/LinkedInAnalyticsReader.js', () => ({
  LinkedInAnalyticsReader: vi.fn().mockImplementation(() => ({
    fetchPostMetrics: vi.fn().mockResolvedValue({ impressions: 100, likes: 10, comments: 2, shares: 1 }),
  })),
}))

vi.mock('../infrastructure/analytics/MetaAnalyticsReader.js', () => ({
  MetaAnalyticsReader: vi.fn().mockImplementation(() => ({
    fetchPostMetrics: vi.fn().mockResolvedValue({ impressions: 0, likes: 0, comments: 0, shares: 0 }),
  })),
}))

vi.mock('../infrastructure/analytics/XAnalyticsReader.js', () => ({
  XAnalyticsReader: vi.fn().mockImplementation(() => ({
    fetchPostMetrics: vi.fn().mockResolvedValue({ impressions: 0, likes: 0, comments: 0, shares: 0 }),
  })),
}))

vi.mock('../infrastructure/publishers/XPublisher.js', () => ({
  XPublisher: vi.fn().mockImplementation(() => ({ publish: vi.fn() })),
}))

vi.mock('../infrastructure/publishers/LinkedInPublisher.js', () => ({
  LinkedInPublisher: vi.fn().mockImplementation(() => ({ publish: vi.fn() })),
}))

vi.mock('../infrastructure/publishers/MetaPublisher.js', () => ({
  MetaPublisher: vi.fn().mockImplementation(() => ({ publish: vi.fn() })),
}))

describe('POST /audience-signal', () => {
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

  it('returns 200 with the computed audience signal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/audience-signal',
      payload: { brandId: 'brand-1', platform: 'linkedin' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ audienceSignal: { postsAnalyzed: number; totalImpressions: number } }>()
    expect(body.audienceSignal.postsAnalyzed).toBe(1)
    expect(body.audienceSignal.totalImpressions).toBe(100)
  })

  it('returns 400 when body is missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/audience-signal',
      payload: { brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when there is no OAuth connection for the platform', async () => {
    mockFindByBrandAndPlatform.mockResolvedValueOnce(null)

    const freshApp = await buildApp()
    await freshApp.ready()

    const response = await freshApp.inject({
      method: 'POST',
      url: '/audience-signal',
      payload: { brandId: 'brand-1', platform: 'linkedin' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    await freshApp.close()
    expect(response.statusCode).toBe(404)
  })

  it('returns 401 when INTERNAL_SECRET header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/audience-signal',
      payload: { brandId: 'brand-1', platform: 'linkedin' },
    })

    expect(response.statusCode).toBe(401)
  })
})
