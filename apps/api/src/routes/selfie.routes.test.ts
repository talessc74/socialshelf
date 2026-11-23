import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const mockFindByBrand = vi.fn().mockResolvedValue([])

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    findByBrand: mockFindByBrand,
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('POST /selfie/ask', () => {
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
    mockFindByBrand.mockReset().mockResolvedValue([])
  })

  it('proxies the question to the generator along with a connection-status summary', async () => {
    mockFindByBrand.mockResolvedValue([
      {
        platform: 'instagram',
        accountLabel: '@minhamarca',
        expiresAt: new Date(Date.now() - 1000),
      },
      {
        platform: 'linkedin',
        accountLabel: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    ])
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ answer: 'Vá em Central de Contas.' }) })

    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      headers: { authorization: 'Bearer valid-token' },
      payload: { question: 'Como conecto o Instagram?', history: [] },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ answer: 'Vá em Central de Contas.' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toBe('http://localhost:3003/selfie/ask')
    const body = JSON.parse(init.body)
    expect(body.question).toBe('Como conecto o Instagram?')
    expect(body.accountStatus).toContainEqual(
      expect.objectContaining({ platform: 'instagram', connected: true, accountLabel: '@minhamarca', connectionLikelyExpired: true }),
    )
    expect(body.accountStatus).toContainEqual(
      expect.objectContaining({ platform: 'linkedin', connected: true, accountLabel: null, connectionLikelyExpired: false }),
    )
    expect(body.accountStatus).toContainEqual(
      expect.objectContaining({ platform: 'facebook', connected: false, connectionLikelyExpired: false }),
    )
  })

  it('rejects an empty question with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      headers: { authorization: 'Bearer valid-token' },
      payload: { question: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      payload: { question: 'Como conecto o Instagram?' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('maps a generator failure to a 502', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })

    const response = await app.inject({
      method: 'POST',
      url: '/selfie/ask',
      headers: { authorization: 'Bearer valid-token' },
      payload: { question: 'Como conecto o Instagram?' },
    })

    expect(response.statusCode).toBe(502)
  })
})
