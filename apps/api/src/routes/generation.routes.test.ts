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

describe('POST /generation-requests', () => {
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

  it('proxies to generator and returns the generation request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ generationRequest: { id: 'gen-1', status: 'ready' } }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests',
      payload: {
        description: 'Post sobre lançamento',
        targetPlatforms: ['linkedin'],
      },
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ generationRequest: { status: string } }>()
    expect(body.generationRequest.status).toBe('ready')
  })

  it('returns 400 when body is missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests',
      payload: {},
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests',
      payload: { description: 'desc', targetPlatforms: ['linkedin'] },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /generation-images/signed-url', () => {
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

  it('returns the signed url for a path owned by the user', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://storage.googleapis.com/signed-url' }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/generation-images/signed-url?path=user-test-123/generated/img.png',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ url: string }>()
    expect(body.url).toBe('https://storage.googleapis.com/signed-url')
  })

  it('returns 403 when path does not belong to the authenticated user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/generation-images/signed-url?path=other-brand/generated/img.png',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(403)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/generation-images/signed-url?path=user-test-123/generated/img.png',
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /generation-requests/:id/artifacts/:position/edit', () => {
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

  it('proxies to generator and returns the updated generation request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ generationRequest: { id: 'gen-1', status: 'ready' } }),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit',
      payload: { instruction: 'deixe o fundo mais claro' },
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
  })

  it('returns 400 when instruction is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit',
      payload: {},
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 when generator returns 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })

    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/missing/artifacts/1/edit',
      payload: { instruction: 'deixe o fundo mais claro' },
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit',
      payload: { instruction: 'deixe o fundo mais claro' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /generation-requests/:id', () => {
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

  it('proxies to generator and returns the generation request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ generationRequest: { id: 'gen-1', status: 'ready' } }),
    })

    const response = await app.inject({
      method: 'GET',
      url: '/generation-requests/gen-1',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
  })

  it('returns 404 when generator returns 404', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' })

    const response = await app.inject({
      method: 'GET',
      url: '/generation-requests/missing',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 401 without auth header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/generation-requests/gen-1',
    })

    expect(response.statusCode).toBe(401)
  })
})
