import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'
import { CreateCreditsCheckoutSessionUseCase } from './CreateCreditsCheckoutSessionUseCase.js'
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

describe('CreateCreditsCheckoutSessionUseCase', () => {
  let useCase: CreateCreditsCheckoutSessionUseCase
  let mockSubscriptionRepo: SubscriptionRepository
  let mockStripe: Stripe

  beforeEach(() => {
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
          create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/session-credits-123' }),
        },
      },
    } as unknown as Stripe

    useCase = new CreateCreditsCheckoutSessionUseCase(mockStripe, mockSubscriptionRepo)
  })

  it('rejeita um tamanho de pacote não permitido', async () => {
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    await expect(
      useCase.execute({ subscription, userEmail: 'user@example.com', creditAmount: 99, webOrigin: 'https://app.com' }),
    ).rejects.toThrow(/Invalid credit pack size/)
    expect(mockStripe.checkout.sessions.create).not.toHaveBeenCalled()
  })

  it.each([50, 150, 400] as const)('cria a sessão corretamente para o pacote de %i créditos', async (creditAmount) => {
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    const result = await useCase.execute({
      subscription,
      userEmail: 'user@example.com',
      creditAmount,
      webOrigin: 'https://app.com',
    })

    expect(result).toEqual({ url: 'https://checkout.stripe.com/session-credits-123' })
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer: 'cus_existing',
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'brl',
              unit_amount: creditAmount * 30,
            }),
            quantity: 1,
          }),
        ],
        metadata: { userId: 'user-1', creditAmount: String(creditAmount) },
        success_url: 'https://app.com/dashboard/billing?credits=success',
        cancel_url: 'https://app.com/dashboard/billing/credits?credits=cancelled',
      }),
    )
  })

  it('reaproveita o Customer existente sem criar outro', async () => {
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    await useCase.execute({ subscription, userEmail: 'user@example.com', creditAmount: 50, webOrigin: 'https://app.com' })

    expect(mockStripe.customers.create).not.toHaveBeenCalled()
    expect(mockSubscriptionRepo.save).not.toHaveBeenCalled()
  })

  it('cria um Customer novo e persiste o id quando o Subscription ainda não tem um', async () => {
    const subscription = makeSubscription()

    await useCase.execute({ subscription, userEmail: 'user@example.com', creditAmount: 50, webOrigin: 'https://app.com' })

    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'user@example.com',
      metadata: { userId: 'user-1' },
    })
    expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ stripeCustomerId: 'cus_new' }))
  })

  it('lança quando o Stripe não devolve uma url de checkout', async () => {
    mockStripe.checkout.sessions.create = vi.fn().mockResolvedValue({ url: null })
    const subscription = makeSubscription({ stripeCustomerId: 'cus_existing' })

    await expect(
      useCase.execute({ subscription, userEmail: 'user@example.com', creditAmount: 50, webOrigin: 'https://app.com' }),
    ).rejects.toThrow(/did not return a checkout url/i)
  })
})
