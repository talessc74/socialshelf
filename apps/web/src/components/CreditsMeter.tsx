'use client'

import Link from 'next/link'
import type { ApiCreditState } from '../lib/api'

interface CreditsMeterProps {
  credits: ApiCreditState | null
  monthlyCreditsIncluded: number | null | undefined
  compact?: boolean
}

// "Termômetro" de créditos de IA — sempre visível independente de ter histórico de uso ou
// não (diferente do resumo mensal, que só existe depois da primeira geração). planRemaining
// null = ilimitado (legacy/admin), tratado como caso à parte, sem barra.
export function CreditsMeter({ credits, monthlyCreditsIncluded, compact = false }: CreditsMeterProps) {
  if (!credits || monthlyCreditsIncluded == null || credits.planRemaining === null) {
    return (
      <div className={compact ? 'flex items-center gap-2 text-sm text-muted' : 'rounded-xl bg-card-2/60 px-3 py-2 text-sm text-muted'}>
        <span>Créditos de IA: <span className="font-medium text-ink">ilimitados</span></span>
      </div>
    )
  }

  const total = monthlyCreditsIncluded
  const remaining = credits.planRemaining
  const percentRemaining = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0
  const barColor =
    percentRemaining > 40 ? 'bg-emerald-500' : percentRemaining > 15 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className={compact ? 'flex min-w-[11rem] flex-col gap-1' : 'space-y-2 rounded-xl bg-card-2/60 px-3 py-2.5'}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          <span className="font-medium text-ink">{remaining}</span> de {total} créditos do plano
        </span>
        {!compact && (
          <Link href="/dashboard/billing/credits" className="font-medium text-accent hover:underline">
            Comprar mais →
          </Link>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentRemaining}%` }}
        />
      </div>
      {credits.purchasedRemaining > 0 && (
        <p className="text-xs text-muted">+ {credits.purchasedRemaining} créditos avulsos guardados</p>
      )}
    </div>
  )
}
