import type Stripe from 'stripe'

export class CreatePortalSessionUseCase {
  constructor(private readonly stripe: Stripe) {}

  async execute(stripeCustomerId: string, webOrigin: string): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${webOrigin}/dashboard/billing`,
    })
    return { url: session.url }
  }
}
