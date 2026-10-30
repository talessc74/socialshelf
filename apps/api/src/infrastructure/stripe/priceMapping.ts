import type { BillingCycle, PlanTier } from '@socialshelf/domain'

export type PayablePlanTier = 'starter' | 'pro' | 'agency'

// Nome das env vars de price ID do Stripe por plano/ciclo (_local-adr-policy-0NN) — um Price
// por combinação tier×ciclo, criado manualmente no Dashboard do Stripe (modo de teste durante
// todo o desenvolvimento, chaveado pra modo real só no lançamento, Fase 9). Única fonte de
// verdade do mapeamento — usado tanto pra criar o Checkout quanto pro webhook interpretar de
// volta qual plano um price id do Stripe representa.
const PRICE_ID_ENV_VARS: Record<PayablePlanTier, Record<BillingCycle, string>> = {
  starter: { monthly: 'STRIPE_PRICE_ID_STARTER_MONTHLY', annual: 'STRIPE_PRICE_ID_STARTER_ANNUAL' },
  pro: { monthly: 'STRIPE_PRICE_ID_PRO_MONTHLY', annual: 'STRIPE_PRICE_ID_PRO_ANNUAL' },
  agency: { monthly: 'STRIPE_PRICE_ID_AGENCY_MONTHLY', annual: 'STRIPE_PRICE_ID_AGENCY_ANNUAL' },
}

export function resolvePriceId(tier: PayablePlanTier, cycle: BillingCycle): string | undefined {
  return process.env[PRICE_ID_ENV_VARS[tier][cycle]]
}

// Varre as env vars (lidas em tempo de chamada, não no import, pra os testes poderem setar
// process.env antes de chamar) e devolve o tier/ciclo cujo price id bate com o informado pelo
// Stripe. undefined quando o price não corresponde a nenhum plano conhecido (ex.: marca
// profissional adicional, que usa price ids próprios — ver _local-adr-policy-0NN).
export function resolveTierAndCycleFromPriceId(priceId: string): { tier: PlanTier; cycle: BillingCycle } | undefined {
  for (const tier of Object.keys(PRICE_ID_ENV_VARS) as PayablePlanTier[]) {
    for (const cycle of Object.keys(PRICE_ID_ENV_VARS[tier]) as BillingCycle[]) {
      if (resolvePriceId(tier, cycle) === priceId) return { tier, cycle }
    }
  }
  return undefined
}
