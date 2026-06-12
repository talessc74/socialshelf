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
  content: [{ platform: 'twitter', text: 'Hello!', charCount: 6 }],
  imageStoragePaths: [],
  status: 'scheduled',
  scheduledAt: null,
  publishedAt: null,
  externalIds: {},
  createdAt: new Date(),
  updatedAt: new Date(),
}

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue(mockPost),
    findByIdAndBrand: vi.fn().mockResolvedValue(mockPost),
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

vi.mock('../infrastructure/secret-manager/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
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

describe('startup validation', () => {
  it('throws if INTERNAL_SECRET is not set', async () => {
    delete process.env['INTERNAL_SECRET']
    await expect(buildApp()).rejects.toThrow('INTERNAL_SECRET')
  })
})

describe('POST /publish', () => {
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

  it('returns 200 with publish results', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
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
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when post is not found', async () => {
    const { FirestorePostRepository } = await import('../infrastructure/firestore/FirestorePostRepository.js')
    vi.mocked(FirestorePostRepository).mockImplementationOnce(() => ({
      findById: vi.fn().mockResolvedValue(null),
      findByIdAndBrand: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any))

    const freshApp = await buildApp()
    await freshApp.ready()

    const response = await freshApp.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'nonexistent', brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    await freshApp.close()
    expect(response.statusCode).toBe(404)
  })

  it('returns 401 when INTERNAL_SECRET header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when INTERNAL_SECRET header is wrong', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'wrong-secret' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('accepts request when correct INTERNAL_SECRET header is provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      payload: { postId: 'post-1', brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
  })
})
