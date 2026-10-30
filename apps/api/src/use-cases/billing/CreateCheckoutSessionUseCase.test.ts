import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { CreateCheckoutSessionUseCase } from './CreateCheckoutSessionUseCase.js'
import type { Subscription, SubscriptionRepository } from '@socialshelf/domain'

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
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

describe('CreateCheckoutSessionUseCase', () => {
  let useCase: CreateCheckoutSessionUseCase
  let mockSubscriptionRepo: SubscriptionRepository
  let mockStripe: Stripe

  beforeEach(() => {
    process.env['STRIPE_PRICE_ID_PRO_MONTHLY'] = 'price_pro_monthly'
    process.env['STRIPE_PRICE_ID_PRO_ANNUAL'] = 'price_pro_annual'

    mockSubscriptionRepo = {
      findByUserId: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    }

    mockStripe = {
      customers: {
        create: vi.fn().mockResolvedValue({ id: 'cus_new' }),
      },
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session-123' }),
        },
      },
    } as unknown as Stripe

    useCase = new CreateCheckoutSessionUseCase(mockStripe, mockSubscriptionRepo)
  })

  it('lança quando a env var do price id do plano/ciclo não está configurada', async () => {
    delete process.env['STRIPE_PRICE_ID_PRO_MONTHLY']
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    await expect(
      useCase.execute({ subscription, userEmail: 'user@example.com', tier: 'pro', cycle: 'monthly', webOrigin: 'https://app.com' }),
    ).rejects.toThrow(/STRIPE_PRICE_ID_PRO_MONTHLY|pro\/monthly/)
  })

  it('cria um Customer no Stripe quando o Subscription ainda não tem um e persiste o id', async () => {
    const subscription = makeSubscription()

    await useCase.execute({ subscription, userEmail: 'user@example.com', tier: 'pro', cycle: 'monthly', webOrigin: 'https://app.com' })

    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      metadata: { userId: 'user-1' },
    })
    expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ stripeCustomerId: 'cus_new' }))
  })

  it('reaproveita o Customer existente sem criar outro', async () => {
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    await useCase.execute({ subscription, userEmail: 'user@example.com', tier: 'pro', cycle: 'annual', webOrigin: 'https://app.com' })

    expect(mockStripe.customers.create).not.toHaveBeenCalled()
    expect(mockSubscriptionRepo.save).not.toHaveBeenCalled()
  })

  it('cria a Checkout Session com o price certo, trial de 7 dias e devolve a url', async () => {
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    const result = await useCase.execute({
      subscription,
      userEmail: 'user@example.com',
      tier: 'pro',
      cycle: 'monthly',
      webOrigin: 'https://app.com',
    })

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session-123' })
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_existing',
        line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
        subscription_data: expect.objectContaining({ trial_period_days: 7 }),
        success_url: 'https://app.com/dashboard/billing?checkout=success',
        cancel_url: 'https://app.com/dashboard/billing/plans?checkout=cancelled',
      }),
    )
  })
})
