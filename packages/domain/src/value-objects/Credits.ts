import type { CreditBalance } from '../entities/CreditBalance.js'
import { brasiliaMonthKey } from './BrasiliaDate.js'
import { GEMINI_IMAGE_USD_PER_IMAGE, USD_TO_BRL_RATE } from './AiPricing.js'

// Fonte única de verdade da conversão crédito↔custo real (_local-adr-policy-0NN) — 1 crédito =
// 1 imagem gerada por IA, o item que domina o custo real (texto/TTS são centavos de centavo
// perto disso, por isso ficam de fora do sistema de créditos). Derivado do mesmo preço de
// imagem já usado em AiPricing.ts, nunca um número solto reescrito aqui.
export const CREDIT_COST_BRL = GEMINI_IMAGE_USD_PER_IMAGE * USD_TO_BRL_RATE

export interface EffectiveCreditState {
  periodKey: string
  // null = ilimitado (legacy/admin) — nenhuma dedução nunca é aplicada nesse caso.
  planRemaining: number | null
  purchasedRemaining: number
  totalAvailable: number | null
}

// Lê o saldo efetivo do período atual sem gravar nada — chamado antes de qualquer geração para
// decidir se segue ou bloqueia, e para calcular o teto mostrado ao usuário ("até X créditos").
// `balance` pode ser de um período anterior (ainda não gravado o reset) ou null (usuário nunca
// gerou nada): o saldo do plano é sempre recalculado a partir do período salvo comparado ao
// atual, nunca lido direto de planCreditsUsed de um mês antigo — reposição preguiçosa, sem job
// agendado (mesmo espírito de resolveEffectiveDailyLimitBrl, descontinuado por este mecanismo).
export function resolveEffectiveCreditState(
  balance: CreditBalance | null,
  planMonthlyCredits: number | null,
  now: Date,
): EffectiveCreditState {
  const periodKey = brasiliaMonthKey(now)
  const purchasedRemaining = balance?.purchasedCreditsBalance ?? 0

  if (planMonthlyCredits === null) {
    return { periodKey, planRemaining: null, purchasedRemaining, totalAvailable: null }
  }

  const usedThisPeriod = balance && balance.periodKey === periodKey ? balance.planCreditsUsed : 0
  const planRemaining = Math.max(0, planMonthlyCredits - usedThisPeriod)

  return { periodKey, planRemaining, purchasedRemaining, totalAvailable: planRemaining + purchasedRemaining }
}

// Aplica o consumo real de créditos depois de uma geração bem-sucedida (nunca antes — o número
// real de imagens produzidas só se sabe depois que a IA decide quantas fazer sentido, até o
// teto negociado antes da chamada). Desconta primeiro do saldo do plano no período atual
// (repondo se o período salvo já virou), só avançando pro avulso depois que o plano zera —
// avulso nunca expira, então não precisa de lógica de período.
//
// Nunca chamado quando planMonthlyCredits é null (ilimitado) — essa checagem é do use-case
// chamador, não deste value object.
export function applyCreditConsumption(
  balance: CreditBalance | null,
  userId: string,
  planMonthlyCredits: number,
  amount: number,
  now: Date,
): CreditBalance {
  const periodKey = brasiliaMonthKey(now)
  const usedThisPeriod = balance && balance.periodKey === periodKey ? balance.planCreditsUsed : 0
  const purchasedBalance = balance?.purchasedCreditsBalance ?? 0

  const planRemaining = Math.max(0, planMonthlyCredits - usedThisPeriod)
  const fromPlan = Math.min(amount, planRemaining)
  const fromPurchased = Math.min(amount - fromPlan, purchasedBalance)

  return {
    userId,
    periodKey,
    planCreditsTotal: planMonthlyCredits,
    planCreditsUsed: usedThisPeriod + fromPlan,
    purchasedCreditsBalance: purchasedBalance - fromPurchased,
    createdAt: balance?.createdAt ?? now,
    updatedAt: now,
  }
}

// Credita um pacote avulso comprado (webhook do Stripe, checkout.session.completed em modo
// 'payment') — nunca mexe no saldo do plano, só soma ao pool de avulso.
export function applyCreditPurchase(
  balance: CreditBalance | null,
  userId: string,
  planMonthlyCredits: number | null,
  purchasedAmount: number,
  now: Date,
): CreditBalance {
  const periodKey = brasiliaMonthKey(now)
  const usedThisPeriod = balance && balance.periodKey === periodKey ? balance.planCreditsUsed : 0

  return {
    userId,
    periodKey,
    planCreditsTotal: planMonthlyCredits ?? 0,
    planCreditsUsed: usedThisPeriod,
    purchasedCreditsBalance: (balance?.purchasedCreditsBalance ?? 0) + purchasedAmount,
    createdAt: balance?.createdAt ?? now,
    updatedAt: now,
  }
}
