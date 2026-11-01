import { MAX_GENERATION_ARTIFACTS } from '@socialshelf/domain'

// Calcula quantas imagens uma geração de IA pode tentar produzir, dado o saldo de créditos
// disponível (_local-adr-policy-0NN) — nunca deixa a geração ir além do que o usuário tem saldo
// pra pagar. `totalAvailable: null` significa ilimitado (legacy/admin), mesmo sentinel já usado
// em PlanLimits/EffectiveCreditState.
export function resolveEffectiveMaxArtifacts(totalAvailable: number | null): number {
  if (totalAvailable === null) return MAX_GENERATION_ARTIFACTS
  return Math.max(0, Math.min(MAX_GENERATION_ARTIFACTS, Math.floor(totalAvailable)))
}

// `null` (ilimitado) sempre tem saldo. Qualquer valor > 0 libera pelo menos uma tentativa de
// geração — a checagem de quantas imagens exatamente cabem é resolveEffectiveMaxArtifacts.
export function hasCreditsAvailable(totalAvailable: number | null): boolean {
  return totalAvailable === null || totalAvailable > 0
}
