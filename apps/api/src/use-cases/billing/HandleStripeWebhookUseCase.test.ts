import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { HandleStripeWebhookUseCase } from './HandleStripeWebhookUseCase.js'
import type { Subscription, SubscriptionRepository } from '@socialshelf/domain'

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    userId: 'user-1',
    tier: 'free',
    billingCycle: null,
    status: 'active',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: null,
    additionalProfessionalBrands: 0,
    adminOverrideUnlimited: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeStripeSubscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    metadata: { userId: 'user-1' },
    trial_end: null,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: 'price_pro_monthly' }, current_period_end: 1893456000 }] },
    ...overrides,
  } as unknown as Stripe.Subscription
}

describe('HandleStripeWebhookUseCase', () => {
  let useCase: HandleStripeWebhookUseCase
  let mockSubscriptionRepo: SubscriptionRepository
  let constructEvent: ReturnType<typeof vi.fn>
  let mockStripe: Stripe

  beforeEach(() => {
    process.env['STRIPE_PRICE_ID_PRO_MONTHLY'] = 'price_pro_monthly'
    process.env['STRIPE_PRICE_ID_PRO_ANNUAL'] = 'price_pro_annual'

    mockSubscriptionRepo = {
      findByUserId: vi.fn().mockResolvedValue(makeSubscription()),
      save: vi.fn().mockResolvedValue(undefined),
    }

    constructEvent = vi.fn()
    mockStripe = { webhooks: { constructEvent } } as unknown as Stripe

    useCase = new HandleStripeWebhookUseCase(mockStripe, mockSubscriptionRepo, 'whsec_test')
  })

  it('verifica a assinatura com o corpo bruto, a assinatura do header e o segredo configurado', async () => {
    constructEvent.mockReturnValue({ type: 'invoice.payment_failed', data: { object: {} } })
    const rawBody = Buffer.from('{"id":"evt_1"}')

    await useCase.execute(rawBody, 'sig_abc')

    expect(constructEvent).toHaveBeenCalledWith(rawBody, 'sig_abc', 'whsec_test')
  })

  it('atualiza tier, ciclo, status e datas em customer.subscription.updated', async () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: makeStripeSubscription({ status: 'trialing', trial_end: 1893456000 }) },
    })

    await useCase.execute(Buffer.from('{}'), 'sig')

    expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'pro',
        billingCycle: 'monthly',
        status: 'trialing',
        stripeSubscriptionId: 'sub_123',
        trialEndsAt: new Date(1893456000 * 1000),
        currentPeriodEnd: new Date(1893456000 * 1000),
      }),
    )
  })

  it('mantém o tier/ciclo atual quando o price não corresponde a nenhum plano conhecido (ex.: marca adicional)', async () => {
    mockSubscriptionRepo.findByUserId = vi.fn().mockResolvedValue(makeSubscription({ tier: 'pro', billingCycle: 'monthly' }))
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: makeStripeSubscription({ items: { data: [{ price: { id: 'price_unknown' }, current_period_end: 1893456000 }] } }) },
    })

    await useCase.execute(Buffer.from('{}'), 'sig')

    expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ tier: 'pro', billingCycle: 'monthly' }))
  })

  it('devolve o usuário pro plano grátis em customer.subscription.deleted', async () => {
    mockSubscriptionRepo.findByUserId = vi.fn().mockResolvedValue(makeSubscription({ tier: 'pro', billingCycle: 'monthly', status: 'active' }))
    constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: makeStripeSubscription() },
    })

    await useCase.execute(Buffer.from('{}'), 'sig')

    expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'free', billingCycle: null, status: 'canceled', cancelAtPeriodEnd: false }),
    )
  })

  it('não grava nada quando a subscription do Stripe não tem metadata.userId', async () => {
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: makeStripeSubscription({ metadata: {} }) },
    })

    await useCase.execute(Buffer.from('{}'), 'sig')

    expect(mockSubscriptionRepo.save).not.toHaveBeenCalled()
  })

  it('não grava nada quando o usuário ainda não tem Subscription persistido', async () => {
    mockSubscriptionRepo.findByUserId = vi.fn().mockResolvedValue(null)
    constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: { object: makeStripeSubscription() },
    })

    await useCase.execute(Buffer.from('{}'), 'sig')

    expect(mockSubscriptionRepo.save).not.toHaveBeenCalled()
  })

  it('ignora silenciosamente eventos não tratados (ex.: invoice.payment_failed)', async () => {
    constructEvent.mockReturnValue({ type: 'invoice.payment_failed', data: { object: {} } })

    await expect(useCase.execute(Buffer.from('{}'), 'sig')).resolves.toBeUndefined()
    expect(mockSubscriptionRepo.save).not.toHaveBeenCalled()
  })
})
