'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'
import { useSubscription } from '../../../../contexts/SubscriptionContext'
import type { ApiBillingCycle, ApiPlanTier } from '../../../../lib/api'

interface PlanDefinition {
  tier: ApiPlanTier
  name: string
  audience: string
  priceMonthly: number
  priceAnnual: number
  additionalBrandMonthly: number | null
  features: string[]
  // Recursos que existem tecnicamente (OAuth, pipeline de publicação) mas não são vendidos
  // ainda — TikTok e X (Twitter) exigem CNPJ pra validar a conexão, e o usuário não vai abrir
  // CNPJ agora (mesma natureza do bloqueio do App Review da Meta, _local-bdr-policy-012). Sem
  // data prometida, vale pra todo plano — não é um recurso pago, é disponibilidade real.
  comingSoon?: string[]
}

// Mesma tabela de preços de _local-bdr-policy-0NN — mantida em sincronia manualmente com
// packages/domain/src/value-objects/PlanLimits.ts (os limites técnicos exatos vêm de lá via
// GET /billing/subscription; esta tabela é só a vitrine comercial, com descrição em
// português e desconto anual já calculado — ~17%, "pague 10 meses, leve 12"). Créditos:
// 1 crédito = 1 imagem gerada por IA (_local-adr-policy-0NN) — substitui o antigo teto de
// gasto diário em R$.
const PLANS: PlanDefinition[] = [
  {
    tier: 'free',
    name: 'Grátis',
    audience: 'Para experimentar',
    priceMonthly: 0,
    priceAnnual: 0,
    additionalBrandMonthly: null,
    features: [
      '1 marca pessoal',
      'Geração manual',
      'LinkedIn, Instagram e Facebook',
      'Histórico de 7 dias',
      '30 créditos de IA/mês',
    ],
    comingSoon: ['TikTok e X (Twitter)'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    audience: 'Pessoa física cuidando da própria marca',
    priceMonthly: 29,
    priceAnnual: 290,
    additionalBrandMonthly: null,
    features: [
      '1 marca pessoal',
      'Autonomia manual ou semi-automática',
      'LinkedIn, Instagram e Facebook',
      'Histórico de 30 dias',
      '100 créditos de IA/mês',
      '7 dias de teste grátis',
    ],
    comingSoon: ['TikTok e X (Twitter)'],
  },
  {
    tier: 'pro',
    name: 'Pro',
    audience: 'Pequeno negócio que quer automação',
    priceMonthly: 97,
    priceAnnual: 970,
    additionalBrandMonthly: 79,
    features: [
      '1 marca profissional incluída',
      'Autonomia automática (até 2 posts/dia)',
      'LinkedIn, Instagram e Facebook',
      'Campanhas de fotos',
      'Dashboard de performance',
      'Histórico de 180 dias',
      '200 créditos de IA/mês',
      '7 dias de teste grátis',
    ],
    comingSoon: ['TikTok e X (Twitter)'],
  },
  {
    tier: 'agency',
    name: 'Agência',
    audience: 'Agência com várias marcas de clientes',
    priceMonthly: 249,
    priceAnnual: 2490,
    additionalBrandMonthly: 69,
    features: [
      '3 marcas profissionais incluídas',
      'Autonomia automática (até 3 posts/dia/marca)',
      'LinkedIn, Instagram e Facebook',
      'Campanhas de fotos',
      'Dashboard de performance',
      'Histórico de 1 ano',
      '600 créditos de IA/mês',
      '7 dias de teste grátis',
    ],
    comingSoon: ['TikTok e X (Twitter)'],
  },
]

function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

export default function PlansPage() {
  const router = useRouter()
  const { subscription } = useSubscription()
  const [cycle, setCycle] = useState<ApiBillingCycle>('monthly')
  const [busyTier, setBusyTier] = useState<ApiPlanTier | null>(null)
  const [error, setError] = useState('')

  const handleSubscribe = async (tier: Exclude<ApiPlanTier, 'legacy' | 'free'>) => {
    setError('')
    setBusyTier(tier)
    try {
      const url = await api.createCheckoutSession(tier, cycle)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar a assinatura.')
      setBusyTier(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Planos</h1>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setCycle('monthly')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            cycle === 'monthly' ? 'bg-accent text-accent-ink' : 'bg-card-2 text-muted'
          }`}
        >
          Mensal
        </button>
        <button
          onClick={() => setCycle('annual')}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
            cycle === 'annual' ? 'bg-accent text-accent-ink' : 'bg-card-2 text-muted'
          }`}
        >
          Anual — ~2 meses grátis
        </button>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual
          const isCurrent = subscription?.tier === plan.tier
          const additionalBrand = plan.additionalBrandMonthly
            ? `+ ${formatBrl(plan.additionalBrandMonthly)}/mês por marca adicional`
            : null

          return (
            <div
              key={plan.tier}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card"
            >
              <div>
                <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
                <p className="text-xs text-muted">{plan.audience}</p>
              </div>

              <div>
                <span className="text-2xl font-bold text-ink">{formatBrl(price)}</span>
                <span className="text-sm text-muted">/{cycle === 'monthly' ? 'mês' : 'ano'}</span>
                {additionalBrand && <p className="mt-1 text-xs text-muted">{additionalBrand}</p>}
              </div>

              <ul className="flex-1 space-y-1.5 text-sm text-muted">
                {plan.features.map((feature) => (
                  <li key={feature}>· {feature}</li>
                ))}
                {plan.comingSoon?.map((feature) => (
                  <li key={feature} className="text-muted/60">
                    · {feature}{' '}
                    <span className="rounded-full bg-card-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Em breve
                    </span>
                  </li>
                ))}
              </ul>

              {plan.tier === 'free' ? (
                <span className="rounded-xl border border-line px-4 py-2 text-center text-sm font-semibold text-muted">
                  {isCurrent ? 'Plano atual' : 'Plano de entrada'}
                </span>
              ) : isCurrent ? (
                <span className="rounded-xl border border-line px-4 py-2 text-center text-sm font-semibold text-muted">
                  Plano atual
                </span>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.tier as Exclude<ApiPlanTier, 'legacy' | 'free'>)}
                  disabled={busyTier !== null}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent/90 disabled:opacity-50"
                >
                  {busyTier === plan.tier ? 'Redirecionando…' : 'Assinar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
