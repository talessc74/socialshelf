import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

const { mockConstructEvent, mockFindSubscription, mockSaveSubscription } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockFindSubscription: vi.fn(),
  mockSaveSubscription: vi.fn(),
}))

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn() },
}))

vi.mock('../infrastructure/firestore/FirestoreSubscriptionRepository.js', () => ({
  FirestoreSubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindSubscription,
    save: mockSaveSubscription,
  })),
}))

vi.mock('../infrastructure/stripe/stripeClient.js', () => ({
  createStripeClient: () => ({
    webhooks: { constructEvent: mockConstructEvent },
  }),
}))

describe('POST /webhooks/stripe', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['PUBLISHER_URL'] = 'http://localhost:3002'
    process.env['GENERATOR_URL'] = 'http://localhost:3003'
    process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockConstructEvent.mockReset()
    mockFindSubscription.mockReset().mockResolvedValue(null)
    mockSaveSubscription.mockReset().mockResolvedValue(undefined)
  })

  it('rejeita uma requisição sem o header stripe-signature', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: JSON.stringify({ id: 'evt_1' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(response.statusCode).toBe(400)
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  it('rejeita quando a verificação de assinatura do Stripe falha', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('signature mismatch')
    })

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: JSON.stringify({ id: 'evt_1' }),
      headers: { 'content-type': 'application/json', 'stripe-signature': 'bad-signature' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('aceita um evento válido e passa o corpo bruto (Buffer) pra verificação', async () => {
    mockConstructEvent.mockReturnValue({ type: 'invoice.payment_failed', data: { object: {} } })

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: JSON.stringify({ id: 'evt_1' }),
      headers: { 'content-type': 'application/json', 'stripe-signature': 'good-signature' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ received: true })
    const [rawBody, signature, secret] = mockConstructEvent.mock.calls[0]!
    expect(Buffer.isBuffer(rawBody)).toBe(true)
    expect(signature).toBe('good-signature')
    expect(secret).toBe('whsec_test')
  })
})
