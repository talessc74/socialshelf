import { startOfBrasiliaDay, convertUsdToBrl } from '@socialshelf/domain'
import type { AiSpendingGuardPort } from '@socialshelf/domain'

// Compartilhado por GenerateContentUseCase e EditArtifactUseCase — os dois pontos de chamada
// de IA instrumentados até agora (_local-edr-policy-071/073). Fail-open de propósito: uma falha
// transitória de leitura (rede, índice) nunca deve travar quem nunca passou do limite de
// verdade — a trava de gasto é um guardrail de custo, não uma fronteira de segurança que
// precise falhar fechado.
// Reclampa o teto configurado na marca pelo teto do plano de assinatura do usuário
// (_local-adr-policy-0NN, Fase 4b) — null em qualquer um dos dois lados significa "sem teto
// desse lado". Um downgrade de plano precisa valer na hora, não só quando o usuário resalvar
// as configurações da marca, por isso isto é recalculado a cada geração, não só ao salvar.
export function resolveEffectiveDailyLimitBrl(
  brandConfiguredLimitBrl: number | null,
  planLimitBrl: number | null,
): number | null {
  if (brandConfiguredLimitBrl === null) return planLimitBrl
  if (planLimitBrl === null) return brandConfiguredLimitBrl
  return Math.min(brandConfiguredLimitBrl, planLimitBrl)
}

export async function isAiSpendingLimitReached(
  guard: AiSpendingGuardPort,
  userId: string,
  brandId: string,
  limitBrl: number | null,
): Promise<boolean> {
  if (limitBrl === null) return false
  try {
    const spentUsd = await guard.sumCostUsdSince(userId, brandId, startOfBrasiliaDay(new Date()))
    return convertUsdToBrl(spentUsd) >= limitBrl
  } catch (err) {
    console.error('Failed to check AI spending limit, allowing generation', err)
    return false
  }
}
