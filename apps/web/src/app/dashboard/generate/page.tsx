'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api, type ApiGenerationRequest, type PublishResponse } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'
import { Stepper } from '../../../components/Stepper'
import { RecommendationPanel } from '../../../components/RecommendationPanel'
import { ScoreBadge } from '../../../components/ScoreBadge'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

const ARTIFACT_STATUS_LABELS: Record<string, string> = {
  pending: 'Na fila',
  generating: 'Gerando…',
  ready: 'Pronto',
  failed: 'Falhou',
}

const STEPS = ['Descrever', 'Gerando', 'Resultado']

function GeneratedImage({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['generation-image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!url) return null

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Artefato gerado" className="aspect-square w-full rounded-lg object-cover" />
}

function useGenerationProgress(active: boolean, totalArtifacts: number) {
  const stages = [
    'Lendo a voz da marca…',
    'Escrevendo a copy para as plataformas escolhidas…',
    ...Array.from({ length: totalArtifacts }, (_, i) => `Criando o card ${i + 1} de ${totalArtifacts}…`),
  ]
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setStageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, stages.length - 1))
    }, 4000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stages.length])

  return { stages, stageIndex }
}

export default function GenerateContentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [description, setDescription] = useState(() => searchParams.get('seed') ?? '')
  const [textContent, setTextContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [artifactCount, setArtifactCount] = useState(1)
  const [topicSuggestionId, setTopicSuggestionId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ApiGenerationRequest | null>(null)
  const [error, setError] = useState('')

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  const { data: suggestions } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: () => api.getTopicSuggestions(),
  })

  const { data: brandProfile } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => api.getBrandProfile(),
  })

  const { stages, stageIndex } = useGenerationProgress(generating, artifactCount)

  const validPlatforms = new Set(Object.values(Platform))
  const connectedPlatforms = connections
    ?.map((c) => c.platform)
    .filter((p) => validPlatforms.has(p)) ?? []
  const selectedSuggestion = suggestions?.find((s) => s.id === topicSuggestionId) ?? null

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const canGenerate = description.trim().length > 0 && selectedPlatforms.size > 0 && !generating

  const handleGenerate = async () => {
    setError('')
    setGenerating(true)
    try {
      const generationRequest = await api.generateContent({
        description: description.trim(),
        ...(textContent.trim() && { textContent: textContent.trim() }),
        targetPlatforms: [...selectedPlatforms],
        artifactCount,
        ...(topicSuggestionId && { topicSuggestionId }),
      })
      setResult(generationRequest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar conteúdo.')
    } finally {
      setGenerating(false)
    }
  }

  const currentStep = result ? 2 : generating ? 1 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Gerar Conteúdo com IA</h1>
      </div>

      <Stepper steps={STEPS} currentStep={currentStep} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {result ? (
            <ResultView result={result} onBack={() => router.push('/dashboard')} />
          ) : generating ? (
            <GeneratingView stages={stages} stageIndex={stageIndex} />
          ) : (
            <FormView
              description={description}
              setDescription={setDescription}
              textContent={textContent}
              setTextContent={setTextContent}
              suggestions={suggestions}
              topicSuggestionId={topicSuggestionId}
              setTopicSuggestionId={setTopicSuggestionId}
              loadingConnections={loadingConnections}
              connectedPlatforms={connectedPlatforms}
              selectedPlatforms={selectedPlatforms}
              togglePlatform={togglePlatform}
              artifactCount={artifactCount}
              setArtifactCount={setArtifactCount}
              error={error}
              canGenerate={canGenerate}
              onGenerate={handleGenerate}
            />
          )}
        </div>

        <RecommendationPanel>
          {brandProfile ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800">{brandProfile.business.name}</p>
              <p className="text-xs text-gray-500">
                Tom de voz: <span className="font-medium text-gray-700">{brandProfile.voice.tone}</span>
              </p>
              <p className="text-xs text-gray-400">
                A copy gerada vai seguir esse tom automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-1 rounded-lg bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">Nenhuma marca cadastrada</p>
              <p className="text-xs text-amber-700">
                Sem perfil de marca, a copy gerada é genérica — sem tom de voz próprio.
              </p>
            </div>
          )}

          {selectedSuggestion && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <p className="text-sm font-medium text-gray-800">{selectedSuggestion.headline}</p>
              <ScoreBadge label="Aderência ao público" score={selectedSuggestion.audienceFitScore} />
              <p className="text-xs text-gray-400">{selectedSuggestion.rationale}</p>
            </div>
          )}

          {result?.outputs?.cta && (
            <div className="space-y-1 border-t border-gray-100 pt-3">
              <p className="text-sm font-medium text-gray-800">CTA sugerido</p>
              <p className="text-xs text-gray-500">{result.outputs.cta}</p>
            </div>
          )}
        </RecommendationPanel>
      </div>
    </div>
  )
}

function FormView({
  description,
  setDescription,
  textContent,
  setTextContent,
  suggestions,
  topicSuggestionId,
  setTopicSuggestionId,
  loadingConnections,
  connectedPlatforms,
  selectedPlatforms,
  togglePlatform,
  artifactCount,
  setArtifactCount,
  error,
  canGenerate,
  onGenerate,
}: {
  description: string
  setDescription: (v: string) => void
  textContent: string
  setTextContent: (v: string) => void
  suggestions: { id: string; headline: string }[] | undefined
  topicSuggestionId: string
  setTopicSuggestionId: (v: string) => void
  loadingConnections: boolean
  connectedPlatforms: Platform[]
  selectedPlatforms: Set<Platform>
  togglePlatform: (p: Platform) => void
  artifactCount: number
  setArtifactCount: (v: number) => void
  error: string
  canGenerate: boolean
  onGenerate: () => void
}) {
  return (
    <>
      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Descreva o que você quer publicar
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Ex: Lançamento da nova funcionalidade de relatórios automáticos…"
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Texto-base (opcional)
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={2}
            placeholder="Cole um rascunho ou referência para a IA usar como ponto de partida…"
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {suggestions && suggestions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Pauta sugerida (opcional)
            </label>
            <select
              value={topicSuggestionId}
              onChange={(e) => setTopicSuggestionId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Nenhuma — usar apenas a descrição</option>
              {suggestions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.headline}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Plataformas</label>
          {loadingConnections ? (
            <p className="text-sm text-gray-400">Carregando conexões…</p>
          ) : connectedPlatforms.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma plataforma conectada.{' '}
              <a href="/dashboard" className="text-brand-600 underline">
                Conectar agora
              </a>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    selectedPlatforms.has(p)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-brand-400'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Quantidade de artefatos
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={10}
              value={artifactCount}
              onChange={(e) => setArtifactCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400">
              {artifactCount === 1 ? 'Post único' : `Carrossel com ${artifactCount} imagens`}
            </p>
          </div>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button
        onClick={onGenerate}
        disabled={!canGenerate}
        className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        Gerar Conteúdo
      </button>
    </>
  )
}

function GeneratingView({ stages, stageIndex }: { stages: string[]; stageIndex: number }) {
  return (
    <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-6 shadow-sm">
      <ol className="space-y-3">
        {stages.map((stage, i) => {
          const isCurrent = i === stageIndex
          const isPast = i < stageIndex
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isCurrent ? 'animate-pulse bg-brand-500' : isPast ? 'bg-brand-200' : 'bg-gray-200'
                }`}
              />
              <span className={`text-sm ${isCurrent ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
                {stage}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-gray-400">
        Isso pode levar até 2 minutos, especialmente para carrosséis com várias imagens. Não saia desta página.
      </p>
    </section>
  )
}

function ResultView({ result, onBack }: { result: ApiGenerationRequest; onBack: () => void }) {
  const readyArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'ready') ?? []
  const failedArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'failed') ?? []
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null)
  const [publishError, setPublishError] = useState('')

  const handlePublish = async () => {
    if (!result.outputs) return
    setPublishError('')
    setPublishing(true)
    try {
      const content = Object.entries(result.outputs.copies).map(([platform, copy]) => ({
        platform: platform as Platform,
        text: copy!.text,
      }))
      const post = await api.createPost(content, readyArtifacts.map((a) => a.imageStoragePath!))
      const response = await api.publishPost(post.id)
      setPublishResult(response)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Erro ao publicar.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Resultado da Geração</h2>

      {result.status === 'ready' ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">Rascunho criado com sucesso.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Falha na geração: {result.error}</p>
        </div>
      )}

      {result.outputs && Object.keys(result.outputs.copies).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Copy gerada</h2>
          {Object.entries(result.outputs.copies).map(([platform, copy]) => (
            <div key={platform} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-sm font-medium text-gray-700">
                {PLATFORM_LABELS[platform as Platform]}
              </p>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{copy?.text}</p>
            </div>
          ))}
        </section>
      )}

      {(readyArtifacts.length > 0 || failedArtifacts.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">
            {(result.outputs?.artifacts.length ?? 0) > 1 ? 'Carrossel' : 'Imagem'}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {result.outputs?.artifacts.map((artifact) => (
              <div key={artifact.position} className="space-y-1">
                {artifact.status === 'ready' && artifact.imageStoragePath ? (
                  <GeneratedImage path={artifact.imageStoragePath} />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                    {ARTIFACT_STATUS_LABELS[artifact.status]}
                  </div>
                )}
                <p className="text-center text-xs text-gray-400">#{artifact.position}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {publishResult ? (
        <div className="space-y-3">
          {publishResult.results.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="mb-2 font-semibold text-green-800">Publicado com sucesso:</p>
              <ul className="space-y-1">
                {publishResult.results.map((r) => (
                  <li key={r.platform} className="text-sm text-green-700">
                    ✓ {PLATFORM_LABELS[r.platform]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {publishResult.failedPlatforms.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-2 font-semibold text-red-800">Falhou:</p>
              <ul className="space-y-1">
                {publishResult.failedPlatforms.map((f) => (
                  <li key={f.platform} className="text-sm text-red-700">
                    ✗ {PLATFORM_LABELS[f.platform]} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        result.status === 'ready' && (
          <div className="space-y-2">
            {publishError && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{publishError}</p>
            )}
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {publishing ? 'Publicando…' : 'Publicar Agora'}
            </button>
          </div>
        )
      )}

      <button
        onClick={onBack}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
      >
        Voltar ao Dashboard
      </button>
    </div>
  )
}
