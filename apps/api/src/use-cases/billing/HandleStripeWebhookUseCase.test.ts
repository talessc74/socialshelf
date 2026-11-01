import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { HandleStripeWebhookUseCase } from './HandleStripeWebhookUseCase.js'
import type { Subscription, SubscriptionRepository, CreditBalanceRepository } from '@socialshelf/domain'

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
      atomicUpdate: vi.fn(),
      applyPurchaseOnce: vi.fn().mockResolvedValue(undefined),
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
    it('credita o pacote avulso quando mode é payment e o metadata está completo, via applyPurchaseOnce (idempotente)', async () => {
      // makeSubscription() default (tier 'free') resolve monthlyCreditsIncluded 30.
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1', creditAmount: '150' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      // applyPurchaseOnce, não save solto: a dedução/dedup por session.id acontece inteira
      // dentro da transação do repositório (_local-adr-policy-044) — o use-case nunca lê o
      // saldo e grava num passo separado, que seria vulnerável a correr duas vezes.
      expect(mockCreditBalanceRepo.applyPurchaseOnce).toHaveBeenCalledWith('user-1', 'cs_123', 30, 150, expect.any(Date))
      expect(mockCreditBalanceRepo.save).not.toHaveBeenCalled()
    })

    it('busca o monthlyCreditsIncluded do plano certo do usuário antes de creditar', async () => {
      mockSubscriptionRepo.findByUserId = vi.fn().mockResolvedValue(makeSubscription({ tier: 'pro' }))
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1', creditAmount: '50' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.applyPurchaseOnce).toHaveBeenCalledWith('user-1', 'cs_123', 200, 50, expect.any(Date))
    })

    it('reenvio do mesmo webhook (mesma Checkout Session) não credita duas vezes — dedup fica a cargo do repositório', async () => {
      // applyPurchaseOnce é quem decide se já processou aquele session.id — o use-case sempre
      // chama, não tem lógica de dedup própria. Este teste prova que o use-case passa o MESMO
      // session.id em reentregas, pra o repositório conseguir deduplicar.
      const session = makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1', creditAmount: '150' } })
      constructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: session } })

      await useCase.execute(Buffer.from('{}'), 'sig')
      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.applyPurchaseOnce).toHaveBeenCalledTimes(2)
      const [firstCallSessionId] = (mockCreditBalanceRepo.applyPurchaseOnce as ReturnType<typeof vi.fn>).mock.calls[0]!.slice(1, 2)
      const [secondCallSessionId] = (mockCreditBalanceRepo.applyPurchaseOnce as ReturnType<typeof vi.fn>).mock.calls[1]!.slice(1, 2)
      expect(firstCallSessionId).toBe('cs_123')
      expect(secondCallSessionId).toBe('cs_123')
    })

    it('ignora quando mode é subscription (já tratado por customer.subscription.*)', async () => {
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'subscription' }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.applyPurchaseOnce).not.toHaveBeenCalled()
    })

    it('ignora quando falta userId no metadata', async () => {
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { creditAmount: '150' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.applyPurchaseOnce).not.toHaveBeenCalled()
    })

    it('ignora quando falta creditAmount no metadata', async () => {
      constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: makeCheckoutSession({ mode: 'payment', metadata: { userId: 'user-1' } }) },
      })

      await useCase.execute(Buffer.from('{}'), 'sig')

      expect(mockCreditBalanceRepo.applyPurchaseOnce).not.toHaveBeenCalled()
    })
  })
})
