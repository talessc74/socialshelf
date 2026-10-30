import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

const { mockVerifyIdToken, mockFindSubscription, mockSaveSubscription, mockBrandFindByUserId } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockFindSubscription: vi.fn(),
  mockSaveSubscription: vi.fn(),
  mockBrandFindByUserId: vi.fn(),
}))

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: mockVerifyIdToken },
}))

vi.mock('../infrastructure/firestore/FirestoreBrandRepository.js', () => ({
  FirestoreBrandRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    findByUserId: mockBrandFindByUserId,
    save: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreSubscriptionRepository.js', () => ({
  FirestoreSubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindSubscription,
    save: mockSaveSubscription,
  })),
}))

const mockCustomersCreate = vi.fn()
const mockCheckoutSessionsCreate = vi.fn()
const mockPortalSessionsCreate = vi.fn()

vi.mock('../infrastructure/stripe/stripeClient.js', () => ({
  createStripeClient: () => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalSessionsCreate } },
  }),
}))

describe('billing.routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['PUBLISHER_URL'] = 'http://localhost:3002'
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['STRIPE_PRICE_ID_PRO_MONTHLY'] = 'price_pro_monthly'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockVerifyIdToken.mockReset().mockResolvedValue({ uid: 'user-test-123', email: 'alguem@exemplo.com' })
    mockFindSubscription.mockReset().mockResolvedValue(null)
    mockSaveSubscription.mockReset().mockResolvedValue(undefined)
    mockBrandFindByUserId.mockReset().mockResolvedValue([])
    mockCustomersCreate.mockReset().mockResolvedValue({ id: 'cus_new' })
    mockCheckoutSessionsCreate.mockReset().mockResolvedValue({ url: 'https://checkout.stripe.com/s/123' })
    mockPortalSessionsCreate.mockReset().mockResolvedValue({ url: 'https://billing.stripe.com/p/123' })
  })

  describe('GET /billing/subscription', () => {
    it('exige autenticação', async () => {
      const response = await app.inject({ method: 'GET', url: '/billing/subscription' })
      expect(response.statusCode).toBe(401)
    })

    it('cria e devolve um Subscription grátis + limites pra usuário novo sem marcas', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/billing/subscription',
        headers: { authorization: 'Bearer test-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ subscription: { tier: string }; limits: { tier: string } }>()
      expect(body.subscription.tier).toBe('free')
      expect(body.limits.tier).toBe('free')
      expect(mockSaveSubscription).toHaveBeenCalled()
    })
  })

  describe('GET /billing/checkout', () => {
    it('devolve 400 pra um tier inválido', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/billing/checkout?tier=invalid&cycle=monthly',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(response.statusCode).toBe(400)
    })

    it('cria a checkout session e devolve a url', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/billing/checkout?tier=pro&cycle=monthly',
        headers: { authorization: 'Bearer test-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ url: 'https://checkout.stripe.com/s/123' })
      expect(mockCheckoutSessionsCreate).toHaveBeenCalled()
    })
  })

  describe('GET /billing/portal', () => {
    it('devolve 409 quando o usuário ainda não tem stripeCustomerId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/billing/portal',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(response.statusCode).toBe(409)
    })

    it('devolve a url do Portal quando o usuário já tem stripeCustomerId', async () => {
      mockFindSubscription.mockResolvedValue({
        userId: 'user-test-123',
        tier: 'pro',
        billingCycle: 'monthly',
        status: 'active',
        stripeCustomerId: 'cus_existing',
        stripeSubscriptionId: 'sub_existing',
        additionalProfessionalBrands: 0,
        adminOverrideUnlimited: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await app.inject({
        method: 'GET',
        url: '/billing/portal',
        headers: { authorization: 'Bearer test-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ url: 'https://billing.stripe.com/p/123' })
    })
  })
})
