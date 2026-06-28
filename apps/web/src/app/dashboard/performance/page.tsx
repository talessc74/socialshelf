'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'
import type { ProfileDiagnostic } from '@socialshelf/domain'
import type { ApiPostPerformanceEntry } from '../../../lib/api'
import { ScoreBadge } from '../../../components/ScoreBadge'
import { ProfileDiagnosticPanel } from '../../../components/ProfileDiagnosticPanel'
import { EngagementOverTimeChart } from '../../../components/EngagementOverTimeChart'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

const ALL_PLATFORMS = [Platform.LINKEDIN, Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TWITTER]

// Erros de permissão/OAuth do Graph API vêm como JSON crú da Meta — não são
// acionáveis para o usuário, então tratamos como "precisa reconectar a conta".
function isPermissionError(message: string): boolean {
  return /OAuthException|pages_read_engagement|Page Public Content Access/i.test(message)
}

// A Meta só libera dados de Insights de Página (e dos posts dela) para Páginas com pelo
// menos 100 seguidores — abaixo disso ela retorna o mesmo erro genérico de permissão acima,
// mesmo com a permissão concedida e a conexão saudável (publicar continua funcionando).
// Reconectar a conta não resolve esse caso: é uma trava da própria Meta pelo tamanho da Página.
function isFacebookFollowerThresholdError(platform: Platform, message: string): boolean {
  return platform === Platform.FACEBOOK && isPermissionError(message)
}

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

  // Default inteligente: prioriza o Instagram e, na falta dele, qualquer rede com dado real —
  // só cai numa rede com erro (ex.: Facebook abaixo de 100 seguidores) se for a única disponível.
  const defaultPlatform =
    (platformsToShow.includes(Platform.INSTAGRAM) && entriesByPlatform.has(Platform.INSTAGRAM)
      ? Platform.INSTAGRAM
      : null) ??
    platformsToShow.find((p) => entriesByPlatform.has(p)) ??
    platformsToShow[0] ??
    null

  const [activePlatform, setActivePlatform] = useState<Platform | null>(null)
  const selectedPlatform = activePlatform && platformsToShow.includes(activePlatform)
    ? activePlatform
    : defaultPlatform

  const selectedError = selectedPlatform ? errorsByPlatform.get(selectedPlatform) : undefined
  const selectedErrorIsPermission = selectedError ? isPermissionError(selectedError) : false
  const selectedErrorIsFollowerThreshold =
    selectedPlatform && selectedError ? isFacebookFollowerThresholdError(selectedPlatform, selectedError) : false

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
  const [diagnosticComputedAt, setDiagnosticComputedAt] = useState<Date | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [hasAutoAnalyzed, setHasAutoAnalyzed] = useState(false)

  const handleAnalyze = useCallback(async () => {
    setAnalyzeError('')
    setAnalyzing(true)
    try {
      const result = await api.getPerformanceInsights()
      setDiagnostic(result)
      setDiagnosticComputedAt(new Date())
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Erro ao gerar o diagnóstico.')
    } finally {
      setAnalyzing(false)
    }
  }, [])

  // Mostra a última análise salva (com data/hora) enquanto a análise automática roda,
  // em vez de deixar a tela vazia até a IA responder.
  useEffect(() => {
    api
      .getLatestPerformanceInsights()
      .then((record) => {
        if (record) {
          setDiagnostic(record.diagnostic)
          setDiagnosticComputedAt(new Date(record.computedAt))
        }
      })
      .catch(() => {})
  }, [])

  // Gera o diagnóstico automaticamente ao entrar na tela, uma única vez por sessão —
  // o botão continua disponível pra refazer a análise manualmente.
  useEffect(() => {
    if (entries.length > 0 && !hasAutoAnalyzed) {
      setHasAutoAnalyzed(true)
      handleAnalyze()
    }
  }, [entries.length, hasAutoAnalyzed, handleAnalyze])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Painel da marca</p>
          <h1 className="text-2xl font-bold text-white">Dashboard de Performance</h1>
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
        <div className="space-y-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="break-words">
            Não foi possível carregar as métricas de performance.
            {error instanceof Error && error.message ? ` [${error.message}]` : ''}
          </p>
          {error instanceof Error && error.message && (
            <button
              onClick={() => navigator.clipboard.writeText(error.message)}
              className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              📋 Copiar erro completo
            </button>
          )}
        </div>
      ) : platformsToShow.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum post publicado com métricas medidas ainda. Publique um post para começar a acompanhar
          a performance.
        </p>
      ) : (
        <>
          {entries.length > 0 && (
            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
                <p className="text-xs font-medium text-gray-500">📈 Impressões totais</p>
                <p className="text-2xl font-bold text-gray-900">{totals.impressions.toLocaleString('pt-BR')}</p>
              </div>
              <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
                <p className="text-xs font-medium text-gray-500">💬 Engajamentos totais</p>
                <p className="text-2xl font-bold text-gray-900">{totals.engagements.toLocaleString('pt-BR')}</p>
              </div>
            </section>
          )}

          {entries.length > 0 && (
            <EngagementOverTimeChart entries={entries} avgEngagementRate={avgEngagementRate} />
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

            {selectedPlatform && selectedError && selectedErrorIsFollowerThreshold && (
              <div className="space-y-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="break-words">
                  As métricas do Facebook só ficam disponíveis quando a Página atinge pelo menos{' '}
                  <strong>100 seguidores</strong> — é uma exigência da própria Meta para liberar dados de
                  Insights, não um problema de conexão. Continue publicando para crescer a Página; assim que
                  atingir esse número, as métricas aparecem aqui automaticamente.
                </p>
                <details className="text-xs text-amber-700">
                  <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
                  <p className="mt-1 break-words">{selectedError}</p>
                </details>
              </div>
            )}

            {selectedPlatform && selectedError && !selectedErrorIsFollowerThreshold && (
              <div className="space-y-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                <p className="break-words">
                  {selectedErrorIsPermission ? (
                    `A conexão com ${PLATFORM_LABELS[selectedPlatform]} perdeu uma permissão necessária para ler as métricas. Reconecte a conta para voltar a acompanhar os resultados.`
                  ) : (
                    <>Não foi possível carregar as métricas de {PLATFORM_LABELS[selectedPlatform]}: {selectedError}</>
                  )}
                </p>
                {selectedErrorIsPermission && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href="/dashboard/accounts"
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      🔄 Reconectar conta
                    </Link>
                    <details className="text-xs text-red-600">
                      <summary className="cursor-pointer select-none">Detalhes técnicos</summary>
                      <p className="mt-1 break-words">{selectedError}</p>
                    </details>
                  </div>
                )}
              </div>
            )}

            {selectedPlatform && (entriesByPlatform.get(selectedPlatform)?.length ?? 0) > 0 && (
              <ul className="space-y-3">
                {entriesByPlatform.get(selectedPlatform)!.map((entry) => (
                  <li
                    key={`${entry.postId}-${entry.platform}`}
                    className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
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
                      className="shrink-0 self-start rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
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
                <div>
                  <h2 className="text-sm font-semibold text-gray-700">Diagnóstico do Perfil</h2>
                  {diagnosticComputedAt && (
                    <p className="text-xs text-gray-400">
                      Última análise: {diagnosticComputedAt.toLocaleDateString('pt-BR')} às{' '}
                      {diagnosticComputedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-200 hover:bg-brand-700 disabled:opacity-40"
                >
                  {analyzing ? 'Analisando…' : diagnostic ? '↻ Refazer análise' : '✨ Gerar Diagnóstico'}
                </button>
              </div>
              {analyzeError && (
                <p className="break-words rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{analyzeError}</p>
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
