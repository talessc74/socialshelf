import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'
import type { Brand } from '@socialshelf/domain'

const {
  mockVerifyIdToken,
  mockBrandFindByUserId,
  mockBrandSave,
  mockBrandFindById,
  mockFindSubscription,
  mockSaveSubscription,
} = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockBrandFindByUserId: vi.fn(),
  mockBrandSave: vi.fn(),
  mockBrandFindById: vi.fn(),
  mockFindSubscription: vi.fn(),
  mockSaveSubscription: vi.fn(),
}))

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: mockVerifyIdToken },
}))

vi.mock('../infrastructure/firestore/FirestoreBrandRepository.js', () => ({
  FirestoreBrandRepository: vi.fn().mockImplementation(() => ({
    findById: mockBrandFindById,
    findByUserId: mockBrandFindByUserId,
    save: mockBrandSave,
    delete: vi.fn(),
    findAll: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    findLatestByBrand: vi.fn().mockResolvedValue(null),
    findByBrandAndVersion: vi.fn(),
    save: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreSubscriptionRepository.js', () => ({
  FirestoreSubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindSubscription,
    save: mockSaveSubscription,
  })),
}))

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-1',
    userId: 'user-test-123',
    name: 'Marca',
    slug: 'marca',
    platforms: [],
    accountType: 'professional',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('brands.routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['PUBLISHER_URL'] = 'http://localhost:3002'
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'user-test-123', email: 'alguem@exemplo.com' })
    mockBrandFindByUserId.mockReset().mockResolvedValue([])
    mockBrandSave.mockReset().mockResolvedValue(undefined)
    mockBrandFindById.mockReset()
    mockFindSubscription.mockReset()
    mockSaveSubscription.mockReset().mockResolvedValue(undefined)
  })

  describe('POST /brands', () => {
    it('devolve 403 quando o accountType pedido não está no plano atual (free só aceita personal)', async () => {
      mockFindSubscription.mockResolvedValue({
        userId: 'user-test-123',
        tier: 'free',
        billingCycle: null,
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await app.inject({
        method: 'POST',
        url: '/brands',
        headers: { authorization: 'Bearer test-token' },
        payload: { name: 'Minha Agência', slug: 'minha-agencia', accountType: 'professional' },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json()).toMatchObject({ error: 'account_type_not_in_plan', upgradeTier: 'starter' })
    })

    it('devolve 409 brand_limit_reached quando o plano Pro (1 marca incluída, 0 adicionais) já está no limite', async () => {
      mockFindSubscription.mockResolvedValue({
        userId: 'user-test-123',
        tier: 'pro',
        billingCycle: 'monthly',
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockBrandFindByUserId.mockResolvedValue([makeBrand()])

      const response = await app.inject({
        method: 'POST',
        url: '/brands',
        headers: { authorization: 'Bearer test-token' },
        payload: { name: 'Segunda Marca', slug: 'segunda-marca', accountType: 'professional' },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json()).toMatchObject({ error: 'brand_limit_reached', upgradeTier: 'agency' })
      expect(mockBrandSave).not.toHaveBeenCalled()
    })

    it('cria a marca quando dentro do limite do plano', async () => {
      mockFindSubscription.mockResolvedValue({
        userId: 'user-test-123',
        tier: 'agency',
        billingCycle: 'monthly',
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockBrandFindByUserId.mockResolvedValue([makeBrand({ id: 'b1' }), makeBrand({ id: 'b2' })])

      const response = await app.inject({
        method: 'POST',
        url: '/brands',
        headers: { authorization: 'Bearer test-token' },
        payload: { name: 'Terceira Marca', slug: 'terceira-marca', accountType: 'professional' },
      })

      expect(response.statusCode).toBe(201)
      expect(mockBrandSave).toHaveBeenCalled()
    })

    it('nunca estoura o limite pra conta legado (ilimitada)', async () => {
      mockFindSubscription.mockResolvedValue({
        userId: 'user-test-123',
        tier: 'legacy',
        billingCycle: null,
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockBrandFindByUserId.mockResolvedValue(Array.from({ length: 20 }, (_, i) => makeBrand({ id: `b${i}` })))

      const response = await app.inject({
        method: 'POST',
        url: '/brands',
        headers: { authorization: 'Bearer test-token' },
        payload: { name: 'Mais uma', slug: 'mais-uma', accountType: 'professional' },
      })

      expect(response.statusCode).toBe(201)
    })
  })

  describe('PATCH /brands/:id', () => {
    it('devolve 403 ao tentar trocar pra um accountType fora do plano atual', async () => {
      mockFindSubscription.mockResolvedValue({
        userId: 'user-test-123',
        tier: 'starter',
        billingCycle: 'monthly',
        status: 'active',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      mockBrandFindById.mockResolvedValue(makeBrand({ accountType: 'personal' }))

      const response = await app.inject({
        method: 'PATCH',
        url: '/brands/brand-1',
        headers: { authorization: 'Bearer test-token' },
        payload: { accountType: 'professional' },
      })

      expect(response.statusCode).toBe(403)
      expect(mockBrandSave).not.toHaveBeenCalled()
    })
  })
})
