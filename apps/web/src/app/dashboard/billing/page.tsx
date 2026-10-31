'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '../../../lib/api'
import { useSubscription } from '../../../contexts/SubscriptionContext'
import type { ApiPlanTier } from '../../../lib/api'

const TIER_LABELS: Record<ApiPlanTier, string> = {
  legacy: 'Legado (acesso ilimitado)',
  free: 'Grátis',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agência',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Em teste grátis',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  incomplete: 'Incompleta',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function BillingPage() {
  const router = useRouter()
  const { subscription, limits, loading } = useSubscription()
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalError, setPortalError] = useState('')

  const handleOpenPortal = async () => {
    setPortalError('')
    setPortalBusy(true)
    try {
      const url = await api.createPortalSession()
      window.location.href = url
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Não foi possível abrir o portal de pagamento.')
      setPortalBusy(false)
    }
  }

  const isPaid = subscription && subscription.tier !== 'legacy' && subscription.tier !== 'free'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Minha Assinatura</h1>
      </div>

      {loading || !subscription || !limits ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">Plano atual: {TIER_LABELS[subscription.tier]}</h2>
              <span className="text-sm text-muted">{STATUS_LABELS[subscription.status] ?? subscription.status}</span>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-muted">Marcas incluídas</dt>
                <dd className="font-medium text-ink">
                  {limits.includedBrands === null ? 'Ilimitadas' : limits.includedBrands}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Nível de autonomia máximo</dt>
                <dd className="font-medium text-ink">{limits.maxAutonomyLevel}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Teto de gasto diário de IA</dt>
                <dd className="font-medium text-ink">
                  {limits.defaultDailyAiSpendingLimitBrl === null
                    ? 'Sem teto'
                    : `R$ ${limits.defaultDailyAiSpendingLimitBrl}/dia`}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted">Histórico</dt>
                <dd className="font-medium text-ink">
                  {limits.historyRetentionDays === null ? 'Sem limite' : `${limits.historyRetentionDays} dias`}
                </dd>
              </div>
              {subscription.trialEndsAt && (
                <div>
                  <dt className="text-xs uppercase text-muted">Teste grátis termina em</dt>
                  <dd className="font-medium text-ink">{formatDate(subscription.trialEndsAt)}</dd>
                </div>
              )}
              {subscription.currentPeriodEnd && (
                <div>
                  <dt className="text-xs uppercase text-muted">
                    {subscription.cancelAtPeriodEnd ? 'Acesso até' : 'Próxima renovação'}
                  </dt>
                  <dd className="font-medium text-ink">{formatDate(subscription.currentPeriodEnd)}</dd>
                </div>
              )}
            </dl>

            {portalError && <p className="text-sm text-red-600">{portalError}</p>}

            <div className="flex flex-wrap gap-3 pt-2">
              {isPaid && (
                <button
                  onClick={handleOpenPortal}
                  disabled={portalBusy}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card-2 disabled:opacity-50"
                >
                  {portalBusy ? 'Abrindo…' : 'Gerenciar assinatura (cancelar, trocar cartão)'}
                </button>
              )}
              <Link
                href="/dashboard/billing/plans"
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/90"
              >
                {isPaid ? 'Trocar de plano' : 'Ver planos'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
