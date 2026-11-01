import type Stripe from 'stripe'
import type { Subscription, SubscriptionRepository, BillingCycle } from '@socialshelf/domain'
import { resolvePriceId, type PayablePlanTier } from '../../infrastructure/stripe/priceMapping.js'
import { ensureStripeCustomer } from './ensureStripeCustomer.js'

export type { PayablePlanTier }

export interface CreateCheckoutSessionInput {
  subscription: Subscription
  userEmail: string | null
  tier: PayablePlanTier
  cycle: BillingCycle
  webOrigin: string
}

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly stripe: Stripe,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(input: CreateCheckoutSessionInput): Promise<{ url: string }> {
    const priceId = resolvePriceId(input.tier, input.cycle)
    if (!priceId) {
      throw new Error(`Missing Stripe price id env var for ${input.tier}/${input.cycle}`)
    }

    const customerId = await ensureStripeCustomer(this.stripe, this.subscriptionRepo, input.subscription, input.userEmail)

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // 7 dias de teste grátis nos 3 planos pagos (decisão de negócio) — nativo do Checkout,
      // cobra o cartão coletado na hora do checkout só depois do trial acabar.
      subscription_data: { trial_period_days: 7, metadata: { userId: input.subscription.userId } },
      client_reference_id: input.subscription.userId,
      success_url: `${input.webOrigin}/dashboard/billing?checkout=success`,
      cancel_url: `${input.webOrigin}/dashboard/billing/plans?checkout=cancelled`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { url: session.url }
  }
}
