'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'
import { ScoreBadge } from '../../../components/ScoreBadge'
import { RecommendationPanel } from '../../../components/RecommendationPanel'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

export default function PerformanceDashboardPage() {
  const router = useRouter()

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['posts-performance'],
    queryFn: () => api.getPostsPerformance(),
  })

  const totals = entries?.reduce(
    (acc, e) => ({
      impressions: acc.impressions + e.metrics.impressions,
      engagements: acc.engagements + e.metrics.likes + e.metrics.comments + e.metrics.shares,
    }),
    { impressions: 0, engagements: 0 },
  )

  const avgEngagementRate =
    entries && entries.length > 0 && totals
      ? totals.engagements / Math.max(totals.impressions, 1)
      : null

  const handleSeed = (entry: { text: string }) => {
    router.push(`/dashboard/generate?seed=${encodeURIComponent(entry.text)}`)
  }

  const [insights, setInsights] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  const handleAnalyze = async () => {
    setAnalyzeError('')
    setAnalyzing(true)
    try {
      const result = await api.getPerformanceInsights()
      setInsights(result)
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Erro ao analisar padrões.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Painel da marca</p>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Performance</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Métricas medidas a partir dos posts já publicados manualmente, via integração real com cada
        plataforma.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Carregando…
        </div>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar as métricas de performance.
        </p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum post publicado com métricas medidas ainda. Publique um post para começar a acompanhar
          a performance.
        </p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
              <p className="text-xs font-medium text-gray-500">📈 Impressões totais</p>
              <p className="text-2xl font-bold text-gray-900">{totals?.impressions.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
              <p className="text-xs font-medium text-gray-500">💬 Engajamentos totais</p>
              <p className="text-2xl font-bold text-gray-900">{totals?.engagements.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
              <p className="text-xs font-medium text-gray-500">⚡ Taxa de engajamento média</p>
              <p className="text-2xl font-bold text-gray-900">
                {avgEngagementRate !== null ? `${(avgEngagementRate * 100).toFixed(1)}%` : '—'}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Ranking de posts</h2>
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li
                  key={`${entry.postId}-${entry.platform}`}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                        {PLATFORM_LABELS[entry.platform]}
                      </span>
                      <ScoreBadge label="score" score={entry.score} />
                      <span className="text-xs text-gray-400">
                        {new Date(entry.publishedAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-800">{entry.text}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {entry.metrics.impressions.toLocaleString('pt-BR')} impressões ·{' '}
                      {entry.metrics.likes} curtidas · {entry.metrics.comments} comentários ·{' '}
                      {entry.metrics.shares} compartilhamentos
                    </p>
                  </div>
                  <button
                    onClick={() => handleSeed(entry)}
                    className="shrink-0 rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                  >
                    🌱 Semear Criação
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Analisar Padrões com IA</h2>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-200 hover:bg-brand-700 disabled:opacity-40"
              >
                {analyzing ? 'Analisando…' : insights ? 'Analisar de novo' : '✨ Analisar Padrões'}
              </button>
            </div>
            {analyzeError && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{analyzeError}</p>
            )}
            {insights && (
              <RecommendationPanel agentLabel="o analista de performance">
                <p className="whitespace-pre-wrap text-sm text-gray-800">{insights}</p>
              </RecommendationPanel>
            )}
          </section>
        </>
      )}
    </div>
  )
}
