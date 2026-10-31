// Assinatura de billing por usuário (_local-bdr-policy-0NN, _local-adr-policy-0NN). Um
// `Subscription` por usuário — não por marca: BDR-009 já descrevia o contrato de cobrança
// como algo do usuário, mesmo com marcas podendo escalar em quantidade dentro do plano.
export type PlanTier = 'legacy' | 'free' | 'starter' | 'pro' | 'agency'

export type BillingCycle = 'monthly' | 'annual'

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'

export interface Subscription {
  userId: string
  tier: PlanTier
  // null para 'legacy'/'free' — esses tiers não têm ciclo de cobrança real no Stripe.
  billingCycle: BillingCycle | null
  status: SubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  // Quantidade de marcas profissionais adicionais contratadas além das incluídas no tier
  // (cobradas como item de quantidade na mesma assinatura do Stripe — _local-bdr-policy-0NN).
  additionalProfessionalBrands: number
  // Setado só na criação (EnsureSubscriptionUseCase), a partir de isAdminEmail — nunca
  // sobrescrito pelo webhook do Stripe. Ver _local-adr-policy-0NN, Fase 5 (bypass de admin).
  adminOverrideUnlimited: boolean
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}
