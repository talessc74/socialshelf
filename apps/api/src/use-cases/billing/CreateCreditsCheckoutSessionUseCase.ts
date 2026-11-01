import type Stripe from 'stripe'
import type { Subscription, SubscriptionRepository } from '@socialshelf/domain'
import { CREDIT_PACK_PRICE_BRL_CENTS_PER_CREDIT, isAllowedCreditPack, type CreditPackSize } from '../../infrastructure/stripe/priceMapping.js'
import { ensureStripeCustomer } from './ensureStripeCustomer.js'

export interface CreateCreditsCheckoutSessionInput {
  subscription: Subscription
  userEmail: string | null
  creditAmount: number
  webOrigin: string
}

// Compra avulsa de créditos (_local-adr-policy-0NN) — Checkout mode 'payment' (cobrança única,
// não assinatura). O saldo só é creditado quando o webhook recebe checkout.session.completed
// com mode 'payment' (HandleStripeWebhookUseCase) — nunca aqui, antes do pagamento confirmar.
export class CreateCreditsCheckoutSessionUseCase {
  constructor(
    private readonly stripe: Stripe,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(input: CreateCreditsCheckoutSessionInput): Promise<{ url: string }> {
    if (!isAllowedCreditPack(input.creditAmount)) {
      throw new Error(`Invalid credit pack size: ${input.creditAmount}`)
    }
    const creditAmount: CreditPackSize = input.creditAmount

    const customerId = await ensureStripeCustomer(this.stripe, this.subscriptionRepo, input.subscription, input.userEmail)

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'brl',
            unit_amount: creditAmount * CREDIT_PACK_PRICE_BRL_CENTS_PER_CREDIT,
            product_data: { name: `${creditAmount} créditos de IA — SocialShelf` },
          },
          quantity: 1,
        },
      ],
      metadata: { userId: input.subscription.userId, creditAmount: String(creditAmount) },
      success_url: `${input.webOrigin}/dashboard/billing?credits=success`,
      cancel_url: `${input.webOrigin}/dashboard/billing/credits?credits=cancelled`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return { url: session.url }
  }
}
