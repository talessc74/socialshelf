'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { USD_TO_BRL_RATE } from '@socialshelf/domain'

function formatBrl(usd: number): string {
  return (usd * USD_TO_BRL_RATE).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// planDailySpendingLimitBrl já vem em BRL (é o teto do plano, não uma estimativa de custo de
// chamada de IA) — nunca passar por formatBrl, que espera USD e multiplicaria duas vezes.
function formatBrlDirect(valueBrl: number): string {
  return valueBrl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function AiUsagePage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => api.getAiUsageSummary(),
  })

  const totalUsd = data?.months.reduce((sum, m) => sum + m.totalUsd, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Meus Gastos de IA</h1>
      </div>

      <p className="text-sm text-muted">
        Estimativa de custo desta marca por mês, separada em texto (Gemini) e imagem (Imagen) — a partir do preço
        público de lista da Vertex AI e dos tokens/imagens realmente gastos em cada chamada. Não é a fatura real do
        Google Cloud (que tem desconto/crédito), e o câmbio usado aqui é aproximado. Defina um teto diário em
        Marca → Operação para travar novas gerações quando esse valor for atingido no dia.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">Não foi possível carregar os gastos desta marca.</p>
      ) : !data || data.months.length === 0 ? (
        <p className="text-sm text-muted">Nenhum uso de IA registrado ainda.</p>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">Resumo mensal</h2>
            <span className="text-sm font-medium text-muted">Total: {formatBrl(totalUsd)}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card-2/60 px-3 py-2 text-sm">
            <span className="text-muted">
              Teto diário do seu plano:{' '}
              <span className="font-medium text-ink">
                {data.planDailySpendingLimitBrl === null
                  ? 'sem teto'
                  : formatBrlDirect(data.planDailySpendingLimitBrl)}
              </span>
            </span>
            <Link href="/dashboard/billing/plans" className="font-medium text-accent hover:underline">
              Ver planos →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-muted">
                  <th className="py-1.5 pr-3">Mês</th>
                  <th className="py-1.5 pr-3">Texto</th>
                  <th className="py-1.5 pr-3">Imagem</th>
                  <th className="py-1.5 pr-3">Áudio</th>
                  <th className="py-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month} className="border-t border-line">
                    <td className="py-1.5 pr-3 font-medium text-ink">{m.month}</td>
                    <td className="py-1.5 pr-3 text-muted">{formatBrl(m.textUsd)}</td>
                    <td className="py-1.5 pr-3 text-muted">{formatBrl(m.imageUsd)}</td>
                    <td className="py-1.5 pr-3 text-muted">{formatBrl(m.audioUsd)}</td>
                    <td className="py-1.5 font-medium text-ink">{formatBrl(m.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
