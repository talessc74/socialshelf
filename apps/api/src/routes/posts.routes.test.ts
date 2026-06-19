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
    findByBrand: vi.fn().mockResolvedValue([
      {
        id: 'conn-1',
        userId: 'user-test-123',
        brandId: 'user-test-123',
        platform: 'linkedin',
        pairwiseId: 'pairwise-li',
        tokenRef: 'token-ref-li',
        scopes: [],
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
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

describe('Posts routes', () => {
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

  describe('GET /connections', () => {
    it('returns list of OAuth connections for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/connections',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ connections: unknown[] }>()
      expect(body.connections).toHaveLength(1)
    })

    it('returns 401 without auth header', async () => {
      const response = await app.inject({ method: 'GET', url: '/connections' })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /posts', () => {
    it('creates a post and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          content: [{ platform: 'linkedin', text: 'Hello LinkedIn!' }],
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json<{ post: { id: string; status: string } }>()
      expect(body.post.status).toBe('draft')
      expect(body.post.id).toBeTruthy()
    })

    it('returns 400 when content is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 422 when text exceeds character limit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          content: [{ platform: 'twitter', text: 'a'.repeat(281) }],
        },
      })

      expect(response.statusCode).toBe(422)
    })

    it('returns 401 without auth header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: { content: [{ platform: 'linkedin', text: 'Hello' }] },
      })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /posts/:id/publish', () => {
    it('proxies to publisher and returns result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          postId: 'post-1',
          results: [{ platform: 'linkedin', externalId: 'urn:li:ugcPost:123' }],
          failedPlatforms: [],
        }),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/posts/post-1/publish',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ results: unknown[] }>()
      expect(body.results).toHaveLength(1)
    })

    it('returns 404 when publisher returns 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })

      const response = await app.inject({
        method: 'POST',
        url: '/posts/missing/publish',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 401 without auth header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts/post-1/publish',
      })
      expect(response.statusCode).toBe(401)
    })
  })
})
