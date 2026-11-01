import type Stripe from 'stripe'
import type { Subscription, SubscriptionRepository } from '@socialshelf/domain'

// A primeira cobrança de um usuário (assinatura ou compra avulsa) cria o Customer no Stripe e
// persiste o id no Subscription — cobranças seguintes (upgrade/downgrade/reassinar/outra compra
// de créditos) reaproveitam o mesmo Customer. Compartilhado entre CreateCheckoutSessionUseCase
// e CreateCreditsCheckoutSessionUseCase, que também é o que CreatePortalSessionUseCase precisa
// já ter pronto.
export async function ensureStripeCustomer(
  stripe: Stripe,
  subscriptionRepo: SubscriptionRepository,
  subscription: Subscription,
  userEmail: string | null,
): Promise<string> {
  if (subscription.stripeCustomerId) return subscription.stripeCustomerId

  const customer = await stripe.customers.create({
    ...(userEmail && { email: userEmail }),
    metadata: { userId: subscription.userId },
  })

  await subscriptionRepo.save({
    ...subscription,
    stripeCustomerId: customer.id,
    updatedAt: new Date(),
  })

  return customer.id
}
