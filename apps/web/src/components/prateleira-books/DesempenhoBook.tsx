'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import type { ProfileDiagnostic } from '@socialshelf/domain'
import { api } from '../../lib/api'
import type { ApiPostPerformanceEntry } from '../../lib/api'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LINKEDIN',
  [Platform.FACEBOOK]: 'FACEBOOK',
  [Platform.INSTAGRAM]: 'INSTAGRAM',
  [Platform.TWITTER]: 'X/TWITTER',
}

const ALL_PLATFORMS = [Platform.LINKEDIN, Platform.FACEBOOK, Platform.INSTAGRAM, Platform.TWITTER]

const BLUEPRINT_BG = '#0c2d4d'
const BLUEPRINT_LINE = 'rgba(160,210,255,0.16)'
const BLUEPRINT_INK = '#bfe3ff'
const BLUEPRINT_DIM = 'rgba(191,227,255,0.5)'
const ANNOTATION = '#e8825a'

function BlueprintPage({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: '-20px',
        padding: '18px',
        minHeight: '530px',
        background: BLUEPRINT_BG,
        backgroundImage: `linear-gradient(${BLUEPRINT_LINE} 1px, transparent 1px), linear-gradient(90deg, ${BLUEPRINT_LINE} 1px, transparent 1px)`,
        backgroundSize: '18px 18px',
        color: BLUEPRINT_INK,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      }}
    >
      {children}
    </div>
  )
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative mb-3 p-2.5" style={{ border: `1px solid ${BLUEPRINT_LINE}` }}>
      <span
        className="absolute -top-2 left-2 px-1"
        style={{ background: BLUEPRINT_BG, fontSize: '8px', letterSpacing: '0.1em', color: ANNOTATION, fontWeight: 700 }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

interface DesempenhoContextValue {
  isLoading: boolean
  isError: boolean
  entries: ApiPostPerformanceEntry[]
  errorsByPlatform: Map<Platform, string>
  platformsToShow: Platform[]
  selectedPlatform: Platform | null
  setSelectedPlatform: (p: Platform) => void
  totals: { impressions: number; engagements: number }
  avgEngagementRate: number | null
  diagnostic: ProfileDiagnostic | null
  diagnosticComputedAt: Date | null
  analyzing: boolean
  analyzeError: string
  handleAnalyze: () => void
}

const DesempenhoContext = createContext<DesempenhoContextValue | null>(null)

export function DesempenhoProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useQuery({
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
    for (const entry of entries) map.set(entry.platform, [...(map.get(entry.platform) ?? []), entry])
    return map
  }, [entries])

  const platformsToShow = ALL_PLATFORMS.filter((p) => entriesByPlatform.has(p) || errorsByPlatform.has(p))
  const [activePlatform, setActivePlatform] = useState<Platform | null>(null)
  const selectedPlatform = (activePlatform && platformsToShow.includes(activePlatform) ? activePlatform : null) ?? platformsToShow[0] ?? null

  const totals = entries.reduce(
    (acc, e) => ({
      impressions: acc.impressions + e.metrics.impressions,
      engagements: acc.engagements + e.metrics.likes + e.metrics.comments + e.metrics.shares,
    }),
    { impressions: 0, engagements: 0 },
  )
  const avgEngagementRate = entries.length > 0 ? totals.engagements / Math.max(totals.impressions, 1) : null

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

  useEffect(() => {
    if (entries.length > 0 && !hasAutoAnalyzed) {
      setHasAutoAnalyzed(true)
      handleAnalyze()
    }
  }, [entries.length, hasAutoAnalyzed, handleAnalyze])

  const value: DesempenhoContextValue = {
    isLoading,
    isError: !!isError,
    entries,
    errorsByPlatform,
    platformsToShow,
    selectedPlatform,
    setSelectedPlatform: setActivePlatform,
    totals,
    avgEngagementRate,
    diagnostic,
    diagnosticComputedAt,
    analyzing,
    analyzeError,
    handleAnalyze,
  }

  return <DesempenhoContext.Provider value={value}>{children}</DesempenhoContext.Provider>
}

function useDesempenho(): DesempenhoContextValue {
  const ctx = useContext(DesempenhoContext)
  if (!ctx) throw new Error('useDesempenho deve ser usado dentro de DesempenhoProvider')
  return ctx
}

function ViralGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(10, value)) / 10
  const angle = pct * 180
  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke={BLUEPRINT_LINE} strokeWidth="8" />
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke={ANNOTATION}
          strokeWidth="8"
          strokeDasharray={`${(angle / 180) * 157} 157`}
        />
        <line
          x1="60"
          y1="65"
          x2={60 + 45 * Math.cos(Math.PI - (angle * Math.PI) / 180)}
          y2={65 - 45 * Math.sin(Math.PI - (angle * Math.PI) / 180)}
          stroke={BLUEPRINT_INK}
          strokeWidth="2"
        />
        <circle cx="60" cy="65" r="3" fill={BLUEPRINT_INK} />
      </svg>
      <p style={{ fontSize: '20px', fontWeight: 700, color: BLUEPRINT_INK, marginTop: '-8px' }}>{value.toFixed(1)}</p>
      <p style={{ fontSize: '8px', letterSpacing: '0.12em', color: BLUEPRINT_DIM }}>POTENCIAL VIRAL /10</p>
    </div>
  )
}

function SpecPlate({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 p-2 text-center" style={{ border: `1px solid ${BLUEPRINT_LINE}` }}>
      <p style={{ fontSize: '15px', fontWeight: 700, color: BLUEPRINT_INK }}>{value}</p>
      <p style={{ fontSize: '7px', letterSpacing: '0.1em', color: BLUEPRINT_DIM }}>{label}</p>
    </div>
  )
}

function EngagementPlot({ entries }: { entries: ApiPostPerformanceEntry[] }) {
  const sorted = [...entries].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()).slice(-10)
  const maxScore = Math.max(...sorted.map((e) => e.score), 1)

  if (sorted.length === 0) {
    return <p style={{ fontSize: '9px', color: BLUEPRINT_DIM }}>SEM DADOS SUFICIENTES PARA O GRÁFICO</p>
  }

  return (
    <div className="flex items-end gap-1" style={{ height: '70px' }}>
      {sorted.map((e, i) => (
        <div key={`${e.postId}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full" title={e.text}>
          <div
            style={{
              width: '100%',
              height: `${Math.max((e.score / maxScore) * 100, 6)}%`,
              background: ANNOTATION,
              opacity: 0.75,
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function DesempenhoDesktopLeft() {
  const { isLoading, isError, entries, totals, diagnostic } = useDesempenho()

  return (
    <BlueprintPage>
      <p style={{ fontSize: '9px', letterSpacing: '0.14em', color: BLUEPRINT_DIM }} className="mb-2">
        FICHA TÉCNICA — DESEMPENHO
      </p>

      {isLoading ? (
        <p style={{ fontSize: '10px', color: BLUEPRINT_DIM }}>CARREGANDO MÉTRICAS…</p>
      ) : isError ? (
        <p style={{ fontSize: '10px', color: ANNOTATION }}>FALHA AO CARREGAR MÉTRICAS.</p>
      ) : entries.length === 0 ? (
        <p style={{ fontSize: '10px', color: BLUEPRINT_DIM }}>NENHUM POST MEDIDO AINDA.</p>
      ) : (
        <>
          <Panel label="POTENCIAL">
            <div className="flex justify-center">
              <ViralGauge value={diagnostic?.viralPotential ?? 0} />
            </div>
          </Panel>

          <Panel label="TOTAIS">
            <div className="flex gap-2">
              <SpecPlate label="IMPRESSÕES" value={totals.impressions.toLocaleString('pt-BR')} />
              <SpecPlate label="ENGAJAMENTOS" value={totals.engagements.toLocaleString('pt-BR')} />
            </div>
          </Panel>

          <Panel label="SCORE / POST (últimos 10)">
            <EngagementPlot entries={entries} />
          </Panel>
        </>
      )}
    </BlueprintPage>
  )
}

function PlatformSwitch({ platform }: { platform: Platform }) {
  const { selectedPlatform, setSelectedPlatform, errorsByPlatform } = useDesempenho()
  const isActive = platform === selectedPlatform
  const hasError = errorsByPlatform.has(platform)
  return (
    <button
      onClick={() => setSelectedPlatform(platform)}
      className="px-2 py-1"
      style={{
        fontSize: '8px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        border: `1px solid ${hasError ? ANNOTATION : BLUEPRINT_LINE}`,
        background: isActive ? BLUEPRINT_INK : 'transparent',
        color: isActive ? BLUEPRINT_BG : hasError ? ANNOTATION : BLUEPRINT_DIM,
      }}
    >
      {hasError ? '⚠ ' : ''}
      {PLATFORM_LABELS[platform]}
    </button>
  )
}

export function DesempenhoDesktopRight() {
  const { isLoading, platformsToShow, selectedPlatform, errorsByPlatform, diagnostic, diagnosticComputedAt, analyzing, analyzeError, handleAnalyze } =
    useDesempenho()

  if (isLoading) return <BlueprintPage><></></BlueprintPage>

  const selectedError = selectedPlatform ? errorsByPlatform.get(selectedPlatform) : undefined

  return (
    <BlueprintPage>
      <p style={{ fontSize: '9px', letterSpacing: '0.14em', color: BLUEPRINT_DIM }} className="mb-2">
        DIAGNÓSTICO DE PERFIL
      </p>

      {platformsToShow.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {platformsToShow.map((p) => (
            <PlatformSwitch key={p} platform={p} />
          ))}
        </div>
      )}

      {selectedError && (
        <Panel label="ALERTA">
          <p style={{ fontSize: '9px', lineHeight: 1.5 }}>{selectedError}</p>
        </Panel>
      )}

      {!diagnostic && !analyzing && (
        <p style={{ fontSize: '9px', color: BLUEPRINT_DIM }} className="mb-2">
          NENHUM DIAGNÓSTICO GERADO AINDA.
        </p>
      )}

      {analyzeError && (
        <p style={{ fontSize: '9px', color: ANNOTATION }} className="mb-2">
          {analyzeError}
        </p>
      )}

      {diagnostic && (
        <>
          <Panel label={`NICHO: ${diagnostic.niche.toUpperCase()}`}>
            <p style={{ fontSize: '10px', lineHeight: 1.5 }}>{diagnostic.diagnosisSummary}</p>
          </Panel>

          {diagnostic.whatWorks.length > 0 && (
            <Panel label="O QUE FUNCIONA">
              <ul className="space-y-1">
                {diagnostic.whatWorks.map((w, i) => (
                  <li key={i} style={{ fontSize: '9px', lineHeight: 1.4 }}>
                    <span style={{ color: ANNOTATION }}>✓</span> <strong>{w.title}</strong> — {w.description}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {diagnostic.engagingThemes.length > 0 && (
            <Panel label="TEMAS DE MAIOR TRAÇÃO">
              <div className="space-y-1.5">
                {diagnostic.engagingThemes.map((t, i) => (
                  <div key={i}>
                    <div className="flex justify-between" style={{ fontSize: '8px', color: BLUEPRINT_DIM }}>
                      <span>{t.label}</span>
                      <span>{Math.round(t.strength * 100)}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ height: '100%', width: `${t.strength * 100}%`, background: ANNOTATION }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(diagnostic.topFormats.length > 0 || diagnostic.bestTimes.length > 0) && (
            <Panel label="FORMATOS / HORÁRIOS">
              <div className="flex flex-wrap gap-1">
                {[...diagnostic.topFormats, ...diagnostic.bestTimes].map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5" style={{ fontSize: '8px', border: `1px solid ${BLUEPRINT_LINE}`, color: BLUEPRINT_DIM }}>
                    {tag}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {diagnostic.actionPlan.length > 0 && (
            <Panel label="PLANO DE AÇÃO">
              <ol className="space-y-1.5">
                {diagnostic.actionPlan.map((step, i) => (
                  <li key={i} style={{ fontSize: '9px', lineHeight: 1.4 }}>
                    <strong style={{ color: ANNOTATION }}>{String(i + 1).padStart(2, '0')}</strong> {step.title} — {step.description}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}

      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        className="mt-2 w-full py-2 font-bold disabled:opacity-40"
        style={{ fontSize: '9px', letterSpacing: '0.08em', background: ANNOTATION, color: '#0c1a14' }}
      >
        {analyzing ? 'ANALISANDO…' : diagnostic ? '↻ REFAZER ANÁLISE' : '▶ GERAR DIAGNÓSTICO'}
      </button>
      {diagnosticComputedAt && (
        <p className="mt-1 text-center" style={{ fontSize: '7px', color: BLUEPRINT_DIM }}>
          ÚLTIMA ANÁLISE: {diagnosticComputedAt.toLocaleDateString('pt-BR')} {diagnosticComputedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </BlueprintPage>
  )
}

const MOBILE_PAGES = ['metricas', 'diagnostico', 'plano'] as const

export function DesempenhoMobile() {
  const {
    isLoading,
    isError,
    entries,
    totals,
    diagnostic,
    platformsToShow,
    selectedPlatform,
    errorsByPlatform,
    analyzing,
    analyzeError,
    handleAnalyze,
    diagnosticComputedAt,
  } = useDesempenho()
  const [pageIndex, setPageIndex] = useState(0)

  if (isLoading) {
    return (
      <BlueprintPage>
        <p style={{ fontSize: '10px', color: BLUEPRINT_DIM }}>CARREGANDO MÉTRICAS…</p>
      </BlueprintPage>
    )
  }
  if (isError || entries.length === 0) {
    return (
      <BlueprintPage>
        <p style={{ fontSize: '10px', color: isError ? ANNOTATION : BLUEPRINT_DIM }}>
          {isError ? 'FALHA AO CARREGAR MÉTRICAS.' : 'NENHUM POST MEDIDO AINDA.'}
        </p>
      </BlueprintPage>
    )
  }

  const page = MOBILE_PAGES[pageIndex]
  const selectedError = selectedPlatform ? errorsByPlatform.get(selectedPlatform) : undefined

  return (
    <BlueprintPage>
      {page === 'metricas' && (
        <>
          <Panel label="POTENCIAL">
            <div className="flex justify-center">
              <ViralGauge value={diagnostic?.viralPotential ?? 0} />
            </div>
          </Panel>
          <Panel label="TOTAIS">
            <div className="flex gap-2">
              <SpecPlate label="IMPRESSÕES" value={totals.impressions.toLocaleString('pt-BR')} />
              <SpecPlate label="ENGAJAMENTOS" value={totals.engagements.toLocaleString('pt-BR')} />
            </div>
          </Panel>
          <Panel label="SCORE / POST">
            <EngagementPlot entries={entries} />
          </Panel>
        </>
      )}

      {page === 'diagnostico' && (
        <>
          {platformsToShow.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {platformsToShow.map((p) => (
                <PlatformSwitch key={p} platform={p} />
              ))}
            </div>
          )}
          {selectedError && (
            <Panel label="ALERTA">
              <p style={{ fontSize: '9px', lineHeight: 1.5 }}>{selectedError}</p>
            </Panel>
          )}
          {diagnostic ? (
            <>
              <Panel label={`NICHO: ${diagnostic.niche.toUpperCase()}`}>
                <p style={{ fontSize: '10px', lineHeight: 1.5 }}>{diagnostic.diagnosisSummary}</p>
              </Panel>
              {diagnostic.engagingThemes.length > 0 && (
                <Panel label="TEMAS DE MAIOR TRAÇÃO">
                  <div className="space-y-1.5">
                    {diagnostic.engagingThemes.map((t, i) => (
                      <div key={i}>
                        <div className="flex justify-between" style={{ fontSize: '8px', color: BLUEPRINT_DIM }}>
                          <span>{t.label}</span>
                          <span>{Math.round(t.strength * 100)}%</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)' }}>
                          <div style={{ height: '100%', width: `${t.strength * 100}%`, background: ANNOTATION }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          ) : (
            <p style={{ fontSize: '9px', color: BLUEPRINT_DIM }}>{analyzing ? 'ANALISANDO…' : 'NENHUM DIAGNÓSTICO GERADO AINDA.'}</p>
          )}
          {analyzeError && <p style={{ fontSize: '9px', color: ANNOTATION }}>{analyzeError}</p>}
        </>
      )}

      {page === 'plano' && (
        <>
          {diagnostic ? (
            <>
              {diagnostic.whatWorks.length > 0 && (
                <Panel label="O QUE FUNCIONA">
                  <ul className="space-y-1">
                    {diagnostic.whatWorks.map((w, i) => (
                      <li key={i} style={{ fontSize: '9px', lineHeight: 1.4 }}>
                        <span style={{ color: ANNOTATION }}>✓</span> <strong>{w.title}</strong> — {w.description}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {diagnostic.actionPlan.length > 0 && (
                <Panel label="PLANO DE AÇÃO">
                  <ol className="space-y-1.5">
                    {diagnostic.actionPlan.map((step, i) => (
                      <li key={i} style={{ fontSize: '9px', lineHeight: 1.4 }}>
                        <strong style={{ color: ANNOTATION }}>{String(i + 1).padStart(2, '0')}</strong> {step.title} — {step.description}
                      </li>
                    ))}
                  </ol>
                </Panel>
              )}
            </>
          ) : (
            <p style={{ fontSize: '9px', color: BLUEPRINT_DIM }}>GERE O DIAGNÓSTICO PARA VER O PLANO.</p>
          )}
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="mt-2 w-full py-2 font-bold disabled:opacity-40"
            style={{ fontSize: '9px', letterSpacing: '0.08em', background: ANNOTATION, color: '#0c1a14' }}
          >
            {analyzing ? 'ANALISANDO…' : diagnostic ? '↻ REFAZER ANÁLISE' : '▶ GERAR DIAGNÓSTICO'}
          </button>
          {diagnosticComputedAt && (
            <p className="mt-1 text-center" style={{ fontSize: '7px', color: BLUEPRINT_DIM }}>
              ÚLTIMA ANÁLISE: {diagnosticComputedAt.toLocaleDateString('pt-BR')}
            </p>
          )}
        </>
      )}

      <div className="flex items-center justify-between pt-2 mt-2" style={{ borderTop: `1px solid ${BLUEPRINT_LINE}` }}>
        <button
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          className="px-3 py-1 disabled:opacity-30"
          style={{ fontSize: '9px', border: `1px solid ${BLUEPRINT_LINE}`, color: BLUEPRINT_INK }}
        >
          ← ANTERIOR
        </button>
        <span style={{ fontSize: '9px', color: BLUEPRINT_DIM }}>
          {pageIndex + 1} / {MOBILE_PAGES.length}
        </span>
        <button
          disabled={pageIndex === MOBILE_PAGES.length - 1}
          onClick={() => setPageIndex((p) => Math.min(MOBILE_PAGES.length - 1, p + 1))}
          className="px-3 py-1 disabled:opacity-30"
          style={{ fontSize: '9px', border: `1px solid ${BLUEPRINT_LINE}`, color: BLUEPRINT_INK }}
        >
          PRÓXIMA →
        </button>
      </div>
    </BlueprintPage>
  )
}
