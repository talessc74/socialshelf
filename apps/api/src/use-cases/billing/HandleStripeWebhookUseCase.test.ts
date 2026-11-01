import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { HandleStripeWebhookUseCase } from './HandleStripeWebhookUseCase.js'
import type { Subscription, SubscriptionRepository, CreditBalance, CreditBalanceRepository } from '@socialshelf/domain'

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

function makeCheckoutSession(overrides: Record<string, unknown> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_123',
    mode: 'payment',
    metadata: { userId: 'user-1', creditAmount: '150' },
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

function makeCreditBalance(overrides: Partial<CreditBalance> = {}): CreditBalance {
  return {
    userId: 'user-1',
    periodKey: '2026-01',
    planCreditsTotal: 100,
    planCreditsUsed: 10,
    purchasedCreditsBalance: 5,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('HandleStripeWebhookUseCase', () => {
  let useCase: HandleStripeWebhookUseCase
  let mockSubscriptionRepo: SubscriptionRepository
  let mockCreditBalanceRepo: CreditBalanceRepository
  let constructEvent: ReturnType<typeof vi.fn>
  let mockStripe: Stripe

  beforeEach(() => {
    process.env['STRIPE_PRICE_ID_PRO_MONTHLY'] = 'price_pro_monthly'
    process.env['STRIPE_PRICE_ID_PRO_ANNUAL'] = 'price_pro_annual'

    mockSubscriptionRepo = {
      findByUserId: vi.fn().mockResolvedValue(makeSubscription()),
      save: vi.fn().mockResolvedValue(undefined),
    }

    mockCreditBalanceRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    }

    constructEvent = vi.fn()
    mockStripe = { webhooks: { constructEvent } } as unknown as Stripe

    useCase = new HandleStripeWebhookUseCase(mockStripe, mockSubscriptionRepo, mockCreditBalanceRepo, 'whsec_test')
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

  describe('checkout.session.completed — compra avulsa de créditos', () => {
    it('credita o pacote avulso quando mode é payment e o metadata está completo', async () => {
      // makeSubscription() default (tier 'free') resolve monthlyCreditsIncluded 30.
      mockCreditBalanceRepo.findByUserId = vi.fn().mockResolvedValue(makeCreditBalance({ purchasedCreditsBalance: 5 }))
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1', creditAmount: '150' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.findByUserId).toHaveBeenCalledWith('user-1')
      expect(mockCreditBalanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', planCreditsTotal: 30, purchasedCreditsBalance: 155 }),
      )
    })

    it('busca o monthlyCreditsIncluded do plano certo do usuário antes de creditar', async () => {
      mockSubscriptionRepo.findByUserId = vi.fn().mockResolvedValue(makeSubscription({ tier: 'pro' }))
      mockCreditBalanceRepo.findByUserId = vi.fn().mockResolvedValue(null)
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1', creditAmount: '50' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ planCreditsTotal: 200, purchasedCreditsBalance: 50 }),
      )
    })

    it('ignora quando mode é subscription (já tratado por customer.subscription.*)', async () => {
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'subscription' }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.save).not.toHaveBeenCalled()
    })

    it('ignora quando falta userId no metadata', async () => {
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { creditAmount: '150' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.save).not.toHaveBeenCalled()
    })

    it('ignora quando falta creditAmount no metadata', async () => {
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.save).not.toHaveBeenCalled()
    })
  })
})
