import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

const { mockVerifyIdToken, mockFindAllAiUsage, mockFindAllBrands, mockGetUsers, mockFindByUserIds, mockSetHandled } =
  vi.hoisted(() => ({
    mockVerifyIdToken: vi.fn(),
    mockFindAllAiUsage: vi.fn(),
    mockFindAllBrands: vi.fn(),
    mockGetUsers: vi.fn(),
    mockFindByUserIds: vi.fn(),
    mockSetHandled: vi.fn(),
  }))

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: mockVerifyIdToken, getUsers: mockGetUsers },
}))

vi.mock('../infrastructure/firestore/FirestoreAiUsageReaderRepository.js', () => ({
  FirestoreAiUsageReaderRepository: vi.fn().mockImplementation(() => ({
    findAll: mockFindAllAiUsage,
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreBrandRepository.js', () => ({
  FirestoreBrandRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findById: vi.fn(),
    findByUserId: vi.fn(),
    delete: vi.fn(),
    findAll: mockFindAllBrands,
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreMetaTesterChecklistRepository.js', () => ({
  FirestoreMetaTesterChecklistRepository: vi.fn().mockImplementation(() => ({
    findByUserIds: mockFindByUserIds,
    setHandled: mockSetHandled,
  })),
}))

describe('GET /admin/ai-usage', () => {
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
    mockFindAllAiUsage.mockReset().mockResolvedValue([])
    mockFindAllBrands.mockReset().mockResolvedValue([])
    mockGetUsers.mockReset().mockResolvedValue({ users: [], notFound: [] })
    mockFindByUserIds.mockReset().mockResolvedValue(new Map())
    mockSetHandled.mockReset().mockResolvedValue(undefined)
  })

  it('rejeita com 403 quando o e-mail autenticado não está na allowlist de admin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/admin/ai-usage',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(403)
    expect(mockFindAllAiUsage).not.toHaveBeenCalled()
  })

  it('retorna o resumo agregado por marca quando o e-mail é de admin', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'admin-uid', email: 'talessc@me.com' })
    mockFindAllBrands.mockResolvedValue([
      {
        id: 'brand-1',
        userId: 'user-1',
        name: 'Eai Jurídico',
        slug: 'eai-juridico',
        platforms: [],
        accountType: 'professional',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    mockFindAllAiUsage.mockResolvedValue([
      {
        id: 'event-1',
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'image-generation',
        operation: 'imagen-generation',
        model: 'imagen-4.0-generate-001',
        promptTokenCount: null,
        candidatesTokenCount: null,
        thoughtsTokenCount: null,
        imageCount: 1,
        estimatedCostUsd: 0.04,
        createdAt: new Date('2026-07-15T00:00:00Z'),
      },
    ])

    const response = await app.inject({
      method: 'GET',
      url: '/admin/ai-usage',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      brands: [
        {
          brandId: 'brand-1',
          brandName: 'Eai Jurídico',
          months: [{ month: '2026-07', textUsd: 0, imageUsd: 0.04, audioUsd: 0, videoUsd: 0, totalUsd: 0.04 }],
        },
      ],
    })
  })

  it('retorna 401 sem cabeçalho de autorização', async () => {
    const response = await app.inject({ method: 'GET', url: '/admin/ai-usage' })
    expect(response.statusCode).toBe(401)
  })
})

describe('GET /admin/signups', () => {
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
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'admin-uid', email: 'talessc@me.com' })
    mockFindAllBrands.mockReset()
    mockGetUsers.mockReset()
    mockFindByUserIds.mockReset()
    mockSetHandled.mockReset().mockResolvedValue(undefined)
  })

  it('rejeita com 403 quando o e-mail autenticado não está na allowlist de admin', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-test-123', email: 'alguem@exemplo.com' })

    const response = await app.inject({
      method: 'GET',
      url: '/admin/signups',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(403)
    expect(mockFindAllBrands).not.toHaveBeenCalled()
  })

  it('agrega por usuário (marca mais antiga), com e-mail e flag de liberação do testador', async () => {
    mockFindAllBrands.mockResolvedValue([
      {
        id: 'brand-1',
        userId: 'user-1',
        name: 'Marca Um',
        slug: 'marca-um',
        platforms: [],
        accountType: 'personal',
        createdAt: new Date('2026-11-20T10:00:00Z'),
        updatedAt: new Date('2026-11-20T10:00:00Z'),
      },
      {
        id: 'brand-2',
        userId: 'user-2',
        name: 'Marca Dois',
        slug: 'marca-dois',
        platforms: [],
        accountType: 'professional',
        createdAt: new Date('2026-11-22T10:00:00Z'),
        updatedAt: new Date('2026-11-22T10:00:00Z'),
      },
    ])
    mockGetUsers.mockResolvedValue({
      users: [
        { uid: 'user-1', email: 'user1@exemplo.com' },
        { uid: 'user-2', email: 'user2@exemplo.com' },
      ],
      notFound: [],
    })
    mockFindByUserIds.mockResolvedValue(new Map([['user-1', { userId: 'user-1', handledAt: new Date() }]]))

    const response = await app.inject({
      method: 'GET',
      url: '/admin/signups',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      signups: [
        { userId: 'user-2', email: 'user2@exemplo.com', signedUpAt: '2026-11-22T10:00:00.000Z', metaTesterHandled: false },
        { userId: 'user-1', email: 'user1@exemplo.com', signedUpAt: '2026-11-20T10:00:00.000Z', metaTesterHandled: true },
      ],
    })
  })
})

describe('POST /admin/signups/:userId/handled', () => {
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
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'admin-uid', email: 'talessc@me.com' })
    mockSetHandled.mockReset().mockResolvedValue(undefined)
  })

  it('rejeita com 403 quando o e-mail autenticado não está na allowlist de admin', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user-test-123', email: 'alguem@exemplo.com' })

    const response = await app.inject({
      method: 'POST',
      url: '/admin/signups/user-1/handled',
      headers: { authorization: 'Bearer valid-token' },
      payload: { handled: true },
    })

    expect(response.statusCode).toBe(403)
    expect(mockSetHandled).not.toHaveBeenCalled()
  })

  it('marca o usuário como liberado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/signups/user-1/handled',
      headers: { authorization: 'Bearer valid-token' },
      payload: { handled: true },
    })

    expect(response.statusCode).toBe(204)
    expect(mockSetHandled).toHaveBeenCalledWith('user-1', true)
  })

  it('rejeita corpo inválido com 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/admin/signups/user-1/handled',
      headers: { authorization: 'Bearer valid-token' },
      payload: { handled: 'sim' },
    })

    expect(response.statusCode).toBe(400)
    expect(mockSetHandled).not.toHaveBeenCalled()
  })
})
