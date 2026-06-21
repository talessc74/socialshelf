'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'
import type { ProfileDiagnostic } from '@socialshelf/domain'
import type { ApiPostPerformanceEntry } from '../../../lib/api'
import { ScoreBadge } from '../../../components/ScoreBadge'
import { ProfileDiagnosticPanel } from '../../../components/ProfileDiagnosticPanel'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

const ALL_PLATFORMS = [Platform.LINKEDIN, Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TWITTER]

export default function PerformanceDashboardPage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['posts-performance'],
    queryFn: () => api.getPostsPerformance(),
  })

  const entries = useMemo(() => data?.entries ?? [], [data])
  const errorsByPlatform = useMemo(() => {
    const map = new Map<Platform, string>()
    for (const e of data?.errors ?? []) map.set(e.platform, e.message)
    return map
  }, [data])

  const entriesByPlatform = useMemo(() => {
    const map = new Map<Platform, ApiPostPerformanceEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.platform) ?? []
      list.push(entry)
      map.set(entry.platform, list)
    }
    return map
  }, [entries])

  // Sessões por rede: só aparecem as plataformas com algum dado ou erro a mostrar,
  // assim uma rede sem conexão ativa não polui a tela.
  const platformsToShow = ALL_PLATFORMS.filter(
    (p) => entriesByPlatform.has(p) || errorsByPlatform.has(p),
  )

  const [activePlatform, setActivePlatform] = useState<Platform | null>(null)
  const selectedPlatform = activePlatform && platformsToShow.includes(activePlatform)
    ? activePlatform
    : platformsToShow[0] ?? null

  const totals = entries.reduce(
    (acc, e) => ({
      impressions: acc.impressions + e.metrics.impressions,
      engagements: acc.engagements + e.metrics.likes + e.metrics.comments + e.metrics.shares,
    }),
    { impressions: 0, engagements: 0 },
  )

  const avgEngagementRate =
    entries.length > 0 ? totals.engagements / Math.max(totals.impressions, 1) : null

  const handleSeed = (entry: { text: string }) => {
    router.push(`/dashboard/generate?seed=${encodeURIComponent(entry.text)}`)
  }

  const [diagnostic, setDiagnostic] = useState<ProfileDiagnostic | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  const handleAnalyze = async () => {
    setAnalyzeError('')
    setAnalyzing(true)
    try {
      const result = await api.getPerformanceInsights()
      setDiagnostic(result)
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Erro ao gerar o diagnóstico.')
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
        plataforma. Cada rede é exibida separadamente — uma falha em uma rede não afeta as demais.
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
      ) : platformsToShow.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum post publicado com métricas medidas ainda. Publique um post para começar a acompanhar
          a performance.
        </p>
      ) : (
        <>
          {entries.length > 0 && (
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
                <p className="text-xs font-medium text-gray-500">📈 Impressões totais</p>
                <p className="text-2xl font-bold text-gray-900">{totals.impressions.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
                <p className="text-xs font-medium text-gray-500">💬 Engajamentos totais</p>
                <p className="text-2xl font-bold text-gray-900">{totals.engagements.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
                <p className="text-xs font-medium text-gray-500">⚡ Taxa de engajamento média</p>
                <p className="text-2xl font-bold text-gray-900">
                  {avgEngagementRate !== null ? `${(avgEngagementRate * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
              {platformsToShow.map((platform) => {
                const hasError = errorsByPlatform.has(platform)
                const isActive = platform === selectedPlatform
                return (
                  <button
                    key={platform}
                    onClick={() => setActivePlatform(platform)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : hasError
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {hasError && '⚠ '}
                    {PLATFORM_LABELS[platform]}
                  </button>
                )
              })}
            </div>

            {selectedPlatform && errorsByPlatform.has(selectedPlatform) && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                Não foi possível carregar as métricas de {PLATFORM_LABELS[selectedPlatform]}: {' '}
                {errorsByPlatform.get(selectedPlatform)}
              </p>
            )}

            {selectedPlatform && (entriesByPlatform.get(selectedPlatform)?.length ?? 0) > 0 && (
              <ul className="space-y-3">
                {entriesByPlatform.get(selectedPlatform)!.map((entry) => (
                  <li
                    key={`${entry.postId}-${entry.platform}`}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
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
            )}

            {selectedPlatform &&
              !errorsByPlatform.has(selectedPlatform) &&
              (entriesByPlatform.get(selectedPlatform)?.length ?? 0) === 0 && (
                <p className="text-sm text-gray-500">
                  Nenhum post publicado com métricas medidas ainda em {PLATFORM_LABELS[selectedPlatform]}.
                </p>
              )}
          </section>

          {entries.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Diagnóstico do Perfil</h2>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-200 hover:bg-brand-700 disabled:opacity-40"
                >
                  {analyzing ? 'Analisando…' : diagnostic ? '↻ Refazer análise' : '✨ Gerar Diagnóstico'}
                </button>
              </div>
              {analyzeError && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{analyzeError}</p>
              )}
              {diagnostic && (
                <ProfileDiagnosticPanel
                  diagnostic={diagnostic}
                  postsAnalyzed={entries.length}
                  onCreatePost={() =>
                    router.push(
                      `/dashboard/generate?seed=${encodeURIComponent(
                        `${diagnostic.niche}: ${diagnostic.actionPlan[0]?.title ?? ''}`,
                      )}`,
                    )
                  }
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
