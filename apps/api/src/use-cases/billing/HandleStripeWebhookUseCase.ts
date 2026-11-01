import type Stripe from 'stripe'
import type { Subscription, SubscriptionRepository, SubscriptionStatus, CreditBalanceRepository } from '@socialshelf/domain'
import { resolveEffectivePlanLimits, applyCreditPurchase } from '@socialshelf/domain'
import { resolveTierAndCycleFromPriceId } from '../../infrastructure/stripe/priceMapping.js'

// Mapeia o status do Stripe pro nosso enum, mais restrito. 'unpaid'/'paused' viram 'past_due':
// pro usuário, o efeito prático é o mesmo (não tem acesso pago até resolver o pagamento), e não
// vale a pena ramificar PlanLimits/gates em mais estados do que o necessário.
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'incomplete':
    case 'incomplete_expired':
    default:
      return 'incomplete'
  }
}

// Processa os eventos do Stripe relevantes pra manter o Subscription em dia
// (_local-adr-policy-0NN). Nunca mexe em adminOverrideUnlimited — essa flag só é setada por
// EnsureSubscriptionUseCase, na criação, a partir de isAdminEmail (Fase 5).
export class HandleStripeWebhookUseCase {
  constructor(
    private readonly stripe: Stripe,
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly creditBalanceRepo: CreditBalanceRepository,
    private readonly webhookSecret: string,
  ) {}

  async execute(rawBody: Buffer, signature: string): Promise<void> {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.applySubscriptionUpdate(event.data.object)
        break
      case 'customer.subscription.deleted':
        await this.applySubscriptionDeleted(event.data.object)
        break
      case 'checkout.session.completed':
        // Só interessa aqui no modo 'payment' (compra avulsa de créditos) — o modo
        // 'subscription' já é tratado inteiramente pelos eventos customer.subscription.*
        // acima, que o Stripe dispara em seguida de qualquer forma.
        await this.applyCreditsPurchase(event.data.object)
        break
      case 'invoice.payment_failed':
        // O status 'past_due'/'unpaid' resultante já chega via customer.subscription.updated
        // logo em seguida — não há lógica própria a aplicar aqui além de deixar o Stripe
        // processar o evento sem erro (evita retry desnecessário do webhook).
        break
      default:
        break
    }
  }

  private async applyCreditsPurchase(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== 'payment') return

    const userId = session.metadata?.['userId']
    const creditAmountRaw = session.metadata?.['creditAmount']
    if (!userId || !creditAmountRaw) return

    const creditAmount = Number(creditAmountRaw)
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) return

    const subscription = await this.subscriptionRepo.findByUserId(userId)
    const monthlyCreditsIncluded = subscription ? resolveEffectivePlanLimits(subscription).monthlyCreditsIncluded : null
    const balance = await this.creditBalanceRepo.findByUserId(userId)
    await this.creditBalanceRepo.save(applyCreditPurchase(balance, userId, monthlyCreditsIncluded, creditAmount, new Date()))
  }

  private async applySubscriptionUpdate(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata['userId']
    if (!userId) return

    const existing = await this.subscriptionRepo.findByUserId(userId)
    // O Subscription já deveria existir (EnsureSubscriptionUseCase roda antes de qualquer
    // Checkout) — sem ele, não há onde persistir o estado real do Stripe.
    if (!existing) return

    const priceId = stripeSubscription.items.data[0]?.price.id
    const resolved = priceId ? resolveTierAndCycleFromPriceId(priceId) : undefined
    const currentPeriodEnd = stripeSubscription.items.data[0]?.current_period_end

    const updated: Subscription = {
      ...existing,
      tier: resolved?.tier ?? existing.tier,
      billingCycle: resolved?.cycle ?? existing.billingCycle,
      status: mapStripeStatus(stripeSubscription.status),
      stripeCustomerId:
        typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    }
    await this.subscriptionRepo.save(updated)
  }

  private async applySubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata['userId']
    if (!userId) return

    const existing = await this.subscriptionRepo.findByUserId(userId)
    if (!existing) return

    // Cancelamento devolve o usuário pro plano Grátis — nunca pro legado, que é exclusivo de
    // quem já usava o produto antes do corte (_local-adr-policy-0NN, Fase 6).
    const updated: Subscription = {
      ...existing,
      tier: 'free',
      billingCycle: null,
      status: 'canceled',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEndsAt: null,
      updatedAt: new Date(),
    }
    await this.subscriptionRepo.save(updated)
  }
}
