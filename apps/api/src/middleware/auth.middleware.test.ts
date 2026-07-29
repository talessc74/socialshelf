import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockVerifyIdToken = vi.fn().mockResolvedValue({ uid: 'user-test-123' })

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
}))

const mockFindById = vi.fn()

vi.mock('../infrastructure/firestore/FirestoreBrandRepository.js', () => ({
  FirestoreBrandRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
  })),
}))

describe('auth middleware — resolução de request.brandId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockFindById.mockReset()
    const { registerAuthMiddleware } = await import('./auth.middleware.js')
    app = Fastify()
    await registerAuthMiddleware(app)
    app.get('/protected', { preHandler: [app.authenticate] }, async (request) => ({
      userId: request.userId,
      brandId: request.brandId,
    }))
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('usa o próprio userId como brandId quando nenhum header X-Brand-Id é enviado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-test-123', brandId: 'user-test-123' })
    expect(mockFindById).not.toHaveBeenCalled()
  })

  it('aceita um X-Brand-Id de marca pertencente ao usuário após validar posse', async () => {
    mockFindById.mockResolvedValueOnce({ id: 'brand-2', userId: 'user-test-123' })

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer valid-token', 'x-brand-id': 'brand-2' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: 'user-test-123', brandId: 'brand-2' })
    expect(mockFindById).toHaveBeenCalledWith('user-test-123', 'brand-2')
  })

  it('rejeita um X-Brand-Id que não pertence ao usuário autenticado', async () => {
    mockFindById.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer valid-token', 'x-brand-id': 'someone-elses-brand' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'invalid_brand' })
  })
})

describe('auth middleware — requireAdmin', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockFindById.mockReset()
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'user-test-123' })
    const { registerAuthMiddleware } = await import('./auth.middleware.js')
    app = Fastify()
    await registerAuthMiddleware(app)
    app.get('/admin-only', { preHandler: [app.authenticate, app.requireAdmin] }, async () => ({ ok: true }))
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('rejeita com 403 quando o e-mail do token não está na allowlist de admin', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'user-test-123', email: 'alguem@exemplo.com' })

    const response = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Forbidden' })
  })

  it('permite acesso quando o e-mail do token está na allowlist de admin', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ uid: 'admin-uid', email: 'talessc@me.com' })

    const response = await app.inject({
      method: 'GET',
      url: '/admin-only',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })
})
