'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'
import { useSubscription } from '../../../../contexts/SubscriptionContext'
import type { ApiCreditPackSize } from '../../../../lib/api'

interface CreditPack {
  amount: ApiCreditPackSize
  priceBrl: number
}

// R$0,30/crédito em todos os pacotes (_local-adr-policy-0NN) — mantido em sincronia manualmente
// com CREDIT_PACK_PRICE_BRL_CENTS_PER_CREDIT em
// apps/api/src/infrastructure/stripe/priceMapping.ts.
const PACKS: CreditPack[] = [
  { amount: 50, priceBrl: 15 },
  { amount: 150, priceBrl: 45 },
  { amount: 400, priceBrl: 120 },
]

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

export default function CreditsPage() {
  const router = useRouter()
  const { credits } = useSubscription()
  const [busyPack, setBusyPack] = useState<ApiCreditPackSize | null>(null)
  const [error, setError] = useState('')

  const handleBuy = async (amount: ApiCreditPackSize) => {
    setError('')
    setBusyPack(amount)
    try {
      const url = await api.createCreditsCheckoutSession(amount)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a compra.')
      setBusyPack(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Comprar créditos</h1>
      </div>

      <p className="text-sm text-muted">
        Créditos avulsos não expiram e são usados só depois que o saldo do seu plano no mês
        acabar.
        {credits && credits.totalAvailable !== null && (
          <> Saldo atual: <span className="font-semibold text-ink">{credits.totalAvailable} créditos</span>.</>
        )}
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {PACKS.map((pack) => (
          <div
            key={pack.amount}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card"
          >
            <div>
              <span className="text-2xl font-bold text-ink">{pack.amount}</span>
              <span className="text-sm text-muted"> créditos</span>
            </div>
            <p className="text-sm text-muted">{formatBrl(pack.priceBrl)}</p>
            <button
              onClick={() => handleBuy(pack.amount)}
              disabled={busyPack !== null}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:opacity-50"
            >
              {busyPack === pack.amount ? 'Redirecionando…' : 'Comprar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
