import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

const { mockVerifyIdToken, mockFindByBrand } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockFindByBrand: vi.fn(),
}))

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: mockVerifyIdToken },
}))

vi.mock('../infrastructure/firestore/FirestoreAiUsageReaderRepository.js', () => ({
  FirestoreAiUsageReaderRepository: vi.fn().mockImplementation(() => ({
    findAll: vi.fn(),
    findByBrand: mockFindByBrand,
  })),
}))

describe('GET /ai-usage', () => {
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

  beforeEach(() => {
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'user-test-123', email: 'alguem@exemplo.com' })
    mockFindByBrand.mockReset().mockResolvedValue([])
  })

  it('retorna o resumo mensal só da própria marca, para qualquer usuário autenticado', async () => {
    mockFindByBrand.mockResolvedValue([
      {
        id: 'event-1',
        userId: 'user-test-123',
        brandId: 'user-test-123',
        category: 'text-generation',
        operation: 'copy-generation',
        model: 'gemini-2.5-flash',
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
        thoughtsTokenCount: 0,
        imageCount: null,
        estimatedCostUsd: 0.002,
        createdAt: new Date('2026-07-15T00:00:00Z'),
      },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/ai-usage',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(mockFindByBrand).toHaveBeenCalledWith('user-test-123', 'user-test-123')
    expect(response.json()).toEqual({
      months: [{ month: '2026-07', textUsd: 0.002, imageUsd: 0, totalUsd: 0.002 }],
    })
  })

  it('retorna 401 sem cabeçalho de autorização', async () => {
    const response = await app.inject({ method: 'GET', url: '/ai-usage' })
    expect(response.statusCode).toBe(401)
  })
})
