import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByBrand: vi.fn().mockResolvedValue([]),
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

describe('GET /audience-signal', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['PUBLISHER_URL'] = 'http://localhost:3002'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('proxies to publisher and returns the audience signal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        audienceSignal: {
          brandId: 'user-test-123',
          platform: 'linkedin',
          postsAnalyzed: 3,
          totalImpressions: 900,
          totalEngagements: 90,
          avgEngagementRate: 0.1,
        },
      }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/audience-signal?platform=linkedin',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ audienceSignal: { postsAnalyzed: number } }>()
    expect(body.audienceSignal.postsAnalyzed).toBe(3)
  })

  it('returns 400 when platform query param is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/audience-signal',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when publisher returns 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })

    const response = await app.inject({
      method: 'GET',
      url: '/audience-signal?platform=linkedin',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/audience-signal?platform=linkedin',
    })

    expect(response.statusCode).toBe(401)
  })
})
