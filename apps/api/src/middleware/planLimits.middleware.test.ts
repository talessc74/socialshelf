import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

const { mockFindSubscription } = vi.hoisted(() => ({
  mockFindSubscription: vi.fn(),
}))

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn() },
}))

vi.mock('../infrastructure/firestore/FirestoreBrandRepository.js', () => ({
  FirestoreBrandRepository: vi.fn().mockImplementation(() => ({
    findByUserId: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreSubscriptionRepository.js', () => ({
  FirestoreSubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindSubscription,
    save: vi.fn().mockResolvedValue(undefined),
  })),
}))

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
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
    ...overrides,
  }
}

describe('registerPlanLimitsMiddleware', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    const { registerPlanLimitsMiddleware } = await import('./planLimits.middleware.js')
    app = Fastify()
    app.decorateRequest('userId', '')
    app.decorateRequest('userEmail', null)
    app.addHook('onRequest', async (request) => {
      request.userId = 'user-1'
      request.userEmail = 'alguem@exemplo.com'
    })
    await registerPlanLimitsMiddleware(app)

    for (const feature of ['tiktokVideo', 'photoCampaigns', 'performanceAnalytics'] as const) {
      app.get(`/${feature}`, { preHandler: [app.requirePlanFeature(feature)] }, async () => ({ ok: true }))
    }
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockFindSubscription.mockReset()
  })

  it('bloqueia com 403 plan_feature_not_included quando o plano Grátis não tem a feature', async () => {
    mockFindSubscription.mockResolvedValue(makeSubscription({ tier: 'free' }))

    const response = await app.inject({ method: 'GET', url: '/photoCampaigns' })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'plan_feature_not_included', feature: 'photoCampaigns', upgradeTier: 'starter' })
  })

  it('libera quando o plano Pro inclui a feature', async () => {
    mockFindSubscription.mockResolvedValue(makeSubscription({ tier: 'pro' }))

    const response = await app.inject({ method: 'GET', url: '/photoCampaigns' })

    expect(response.statusCode).toBe(200)
  })

  it('vídeo para TikTok não está incluído em nenhum plano por enquanto, mesmo nos pagos — nunca sugere upgrade', async () => {
    mockFindSubscription.mockResolvedValue(makeSubscription({ tier: 'agency' }))

    const response = await app.inject({ method: 'GET', url: '/tiktokVideo' })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'plan_feature_not_included', feature: 'tiktokVideo', upgradeTier: null })
  })

  it('libera tudo para adminOverrideUnlimited, independente do tier', async () => {
    mockFindSubscription.mockResolvedValue(makeSubscription({ tier: 'free', adminOverrideUnlimited: true }))

    const response = await app.inject({ method: 'GET', url: '/performanceAnalytics' })

    expect(response.statusCode).toBe(200)
  })

  it('bloqueia performanceAnalytics no Starter mas libera no Agência', async () => {
    mockFindSubscription.mockResolvedValue(makeSubscription({ tier: 'starter' }))
    const starterResponse = await app.inject({ method: 'GET', url: '/performanceAnalytics' })
    expect(starterResponse.statusCode).toBe(403)

    mockFindSubscription.mockResolvedValue(makeSubscription({ tier: 'agency' }))
    const agencyResponse = await app.inject({ method: 'GET', url: '/performanceAnalytics' })
    expect(agencyResponse.statusCode).toBe(200)
  })
})
