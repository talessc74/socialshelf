import type Stripe from 'stripe'
import type { Subscription, SubscriptionRepository, SubscriptionStatus, CreditBalanceRepository } from '@socialshelf/domain'
import { resolveEffectivePlanLimits } from '@socialshelf/domain'
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
    // applyPurchaseOnce, não um read+save solto: o Stripe pode reenviar o mesmo webhook (retry
    // em timeout/5xx é esperado), e sem dedup por session.id o usuário seria creditado duas
    // vezes pela mesma compra (_local-adr-policy-044).
    await this.creditBalanceRepo.applyPurchaseOnce(userId, session.id, monthlyCreditsIncluded, creditAmount, new Date())
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

    // Só tenta resolver/checar fingerprint se ainda não tem um salvo (primeiro evento desta
    // assinatura) — depois disso vira no-op, sem chamada nenhuma ao Stripe.
    const cardFingerprint =
      existing.cardFingerprint ?? (await this.guardAgainstReusedTrial(stripeSubscription, existing.userId))

    const updated: Subscription = {
      ...existing,
      tier: resolved?.tier ?? existing.tier,
      billingCycle: resolved?.cycle ?? existing.billingCycle,
      status: mapStripeStatus(stripeSubscription.status),
      stripeCustomerId:
        typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      cardFingerprint,
      trialEndsAt: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    }
    await this.subscriptionRepo.save(updated)
  }

  // Proteção contra reuso de teste grátis (_local-adr-policy-0NN): só roda enquanto a
  // assinatura está em trial e ainda não tem fingerprint salvo — nunca depois (evita repetir a
  // chamada ao Stripe a cada customer.subscription.updated subsequente, que são muitos). Lê o
  // cartão coletado via `pending_setup_intent` (o Checkout não cobra nada ainda durante o
  // trial, então o cartão fica como SetupIntent, não PaymentIntent). Se o mesmo cartão já
  // passou por um trial em outro userId, encerra o trial atual na hora — o Stripe cobra o
  // cartão imediatamente, tirando o incentivo de criar conta nova pra repetir o teste.
  private async guardAgainstReusedTrial(stripeSubscription: Stripe.Subscription, userId: string): Promise<string | null> {
    if (stripeSubscription.status !== 'trialing') return null

    const setupIntentId =
      typeof stripeSubscription.pending_setup_intent === 'string'
        ? stripeSubscription.pending_setup_intent
        : stripeSubscription.pending_setup_intent?.id
    if (!setupIntentId) return null

    const setupIntent = await this.stripe.setupIntents.retrieve(setupIntentId, { expand: ['payment_method'] })
    const paymentMethod = setupIntent.payment_method
    const fingerprint = typeof paymentMethod === 'object' ? (paymentMethod?.card?.fingerprint ?? null) : null
    if (!fingerprint) return null

    const otherSubscriptionsWithSameCard = await this.subscriptionRepo.findByCardFingerprint(fingerprint)
    const cardAlreadyTrialedElsewhere = otherSubscriptionsWithSameCard.some(
      (sub) => sub.userId !== userId && sub.trialEndsAt !== null,
    )
    if (cardAlreadyTrialedElsewhere) {
      await this.stripe.subscriptions.update(stripeSubscription.id, { trial_end: 'now' })
    }

    return fingerprint
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
