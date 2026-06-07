import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue({
      id: 'post-1',
      userId: 'user-1',
      brandId: 'brand-1',
      content: [{ platform: 'twitter', text: 'Hello!', charCount: 6 }],
      imageStoragePaths: [],
      status: 'scheduled',
      scheduledAt: null,
      publishedAt: null,
      externalIds: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    save: vi.fn().mockResolvedValue(undefined),
    findByBrand: vi.fn(),
    findScheduledBefore: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    findByBrandAndPlatform: vi.fn().mockResolvedValue({
      id: 'conn-1',
      userId: 'user-1',
      brandId: 'brand-1',
      platform: 'twitter',
      pairwiseId: 'pairwise-tw',
      tokenRef: 'token-ref-tw',
      scopes: [],
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    save: vi.fn(),
    findById: vi.fn(),
    findByPairwise: vi.fn(),
    findByBrand: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/secret-manager/SecretManagerTokenVault.js', () => ({
  SecretManagerTokenVault: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue(JSON.stringify({ access_token: 'x-token' })),
    store: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/publishers/XPublisher.js', () => ({
  XPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({ externalId: 'tweet-123', publishedAt: new Date() }),
  })),
}))

vi.mock('../infrastructure/publishers/LinkedInPublisher.js', () => ({
  LinkedInPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({ externalId: 'urn:li:ugcPost:456', publishedAt: new Date() }),
  })),
}))

vi.mock('../infrastructure/publishers/MetaPublisher.js', () => ({
  MetaPublisher: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue({ externalId: 'fb-post-789', publishedAt: new Date() }),
  })),
}))

describe('POST /publish', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['WEB_URL'] = 'http://localhost:3000'
    delete process.env['INTERNAL_SECRET']
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 200 with publish results', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ postId: string; results: unknown[] }>()
    expect(body.postId).toBe('post-1')
    expect(body.results).toHaveLength(1)
  })

  it('returns 400 when body is missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when post is not found', async () => {
    const { FirestorePostRepository } = await import('../infrastructure/firestore/FirestorePostRepository.js')
    vi.mocked(FirestorePostRepository).mockImplementationOnce(() => ({
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
    }))

    // Re-build app with new mock
    const freshApp = await buildApp()
    await freshApp.ready()

    const response = await freshApp.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'nonexistent', brandId: 'brand-1' },
    })

    await freshApp.close()
    expect(response.statusCode).toBe(404)
  })

  it('returns 401 when INTERNAL_SECRET is set and header is missing', async () => {
    process.env['INTERNAL_SECRET'] = 'super-secret-123'
    const securedApp = await buildApp()
    await securedApp.ready()

    const response = await securedApp.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
    })

    await securedApp.close()
    delete process.env['INTERNAL_SECRET']

    expect(response.statusCode).toBe(401)
  })

  it('accepts request when correct INTERNAL_SECRET header is provided', async () => {
    process.env['INTERNAL_SECRET'] = 'super-secret-123'
    const securedApp = await buildApp()
    await securedApp.ready()

    const response = await securedApp.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'super-secret-123' },
    })

    await securedApp.close()
    delete process.env['INTERNAL_SECRET']

    expect(response.statusCode).toBe(200)
  })
})
