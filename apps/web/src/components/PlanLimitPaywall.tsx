'use client'

import Link from 'next/link'
import { ApiError } from '../lib/api'

// Códigos de erro que as rotas de billing/gates de plano devolvem (_local-adr-policy-0NN,
// Fase 4) — qualquer outro ApiError é um erro comum (validação, 500 etc.), tratado pela
// página como sempre, não como um paywall.
const PLAN_LIMIT_CODES = new Set([
  'brand_limit_reached',
  'plan_feature_not_included',
  'autonomy_level_not_in_plan',
  'account_type_not_in_plan',
])

const FEATURE_LABELS: Record<string, string> = {
  tiktokVideo: 'vídeo para TikTok',
  photoCampaigns: 'campanhas de fotos',
  performanceAnalytics: 'dashboard de performance',
}

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agência',
}

export function isPlanLimitError(err: unknown): err is ApiError {
  return err instanceof ApiError && !!err.code && PLAN_LIMIT_CODES.has(err.code)
}

function describeError(error: ApiError): string {
  switch (error.code) {
    case 'brand_limit_reached':
      return 'Você atingiu o limite de marcas do seu plano atual.'
    case 'plan_feature_not_included':
      return `Seu plano atual não inclui ${FEATURE_LABELS[error.feature ?? ''] ?? 'esse recurso'}.`
    case 'autonomy_level_not_in_plan':
      return 'O nível de autonomia escolhido não está incluído no seu plano atual.'
    case 'account_type_not_in_plan':
      return 'Esse tipo de conta não está disponível no seu plano atual.'
    default:
      return 'Esse recurso não está disponível no seu plano atual.'
  }
}

// Modal/banner de upgrade, em vez do toast de erro genérico, pra qualquer página que capture
// um erro de gate de plano (_local-adr-policy-0NN, Fase 7). Uso:
//   catch (err) { if (isPlanLimitError(err)) setPlanLimitError(err); else setError(...) }
//   {planLimitError && <PlanLimitPaywall error={planLimitError} />}
export function PlanLimitPaywall({ error }: { error: ApiError }) {
  const upgradeTierLabel = error.upgradeTier ? TIER_LABELS[error.upgradeTier] : null

  return (
    <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">{describeError(error)}</p>
      <Link
        href="/dashboard/billing/plans"
        className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/90"
      >
        {upgradeTierLabel ? `Fazer upgrade para o ${upgradeTierLabel}` : 'Ver planos'}
      </Link>
    </div>
  )
}
