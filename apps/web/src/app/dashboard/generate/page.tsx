'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api, type ApiGenerationRequest, type PublishResponse } from '../../../lib/api'
import {
  Platform,
  PLATFORM_MEDIA_SUPPORT,
  TemplateStyle,
  AspectRatio,
  type GenerationArtifact,
} from '@socialshelf/domain'
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

const COMING_SOON_PLATFORMS = new Set<Platform>([Platform.TWITTER])

const PLATFORM_MEDIA_NOTE: Record<Platform, string> = Object.fromEntries(
  Object.values(Platform).map((p) => [
    p,
    PLATFORM_MEDIA_SUPPORT[p].requiresImage
      ? 'Exige imagem'
      : PLATFORM_MEDIA_SUPPORT[p].supportsImage
        ? 'Aceita imagem'
        : 'Apenas texto',
  ]),
) as Record<Platform, string>

const TEMPLATE_STYLE_OPTIONS: Array<{ value: TemplateStyle; label: string }> = [
  { value: TemplateStyle.BOLD_BOTTOM, label: 'Faixa inferior' },
  { value: TemplateStyle.CENTERED_OVERLAY, label: 'Overlay escuro' },
  { value: TemplateStyle.TOP_STRIP, label: 'Faixa superior' },
]

const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string; preview: string }> = [
  { value: AspectRatio.SQUARE, label: 'Quadrado', preview: 'aspect-square' },
  { value: AspectRatio.PORTRAIT, label: 'Retrato', preview: 'aspect-[3/4]' },
  { value: AspectRatio.LANDSCAPE, label: 'Paisagem', preview: 'aspect-video' },
  { value: AspectRatio.STORY, label: 'Stories', preview: 'aspect-[9/16]' },
]

const ASPECT_RATIO_CLASS: Record<AspectRatio, string> = {
  [AspectRatio.SQUARE]: 'aspect-square',
  [AspectRatio.PORTRAIT]: 'aspect-[3/4]',
  [AspectRatio.LANDSCAPE]: 'aspect-video',
  [AspectRatio.STORY]: 'aspect-[9/16]',
}

function GeneratedImage({ path, aspectClass }: { path: string; aspectClass: string }) {
  const { data: url, isLoading, isError, error } = useQuery({
    queryKey: ['generation-image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading) {
    return (
      <div className={`flex w-full items-center justify-center rounded-lg bg-gray-100 ${aspectClass}`}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !url) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2 text-center text-xs text-gray-400 ${aspectClass}`}
      >
        <span>Não foi possível carregar a imagem</span>
        {error instanceof Error && <span className="break-words text-red-600">{error.message}</span>}
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Artefato gerado" className={`w-full rounded-lg object-cover ${aspectClass}`} />
}

function LightboxImage({ path, aspectClass }: { path: string; aspectClass: string }) {
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ['generation-image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading) {
    return (
      <div className={`flex max-h-[70vh] w-full max-w-md items-center justify-center rounded-lg bg-gray-800 ${aspectClass}`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  if (isError || !url) {
    return (
      <div className={`flex max-h-[70vh] w-full max-w-md items-center justify-center rounded-lg bg-gray-800 text-sm text-gray-300 ${aspectClass}`}>
        Não foi possível carregar a imagem
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt="Artefato gerado"
      className={`max-h-[70vh] w-full max-w-md rounded-lg object-contain ${aspectClass}`}
    />
  )
}

function Lightbox({
  artifacts,
  aspectClass,
  index,
  setIndex,
  generationRequestId,
  onResultUpdate,
  onClose,
}: {
  artifacts: GenerationArtifact[]
  aspectClass: string
  index: number
  setIndex: (i: number) => void
  generationRequestId: string
  onResultUpdate: (r: ApiGenerationRequest) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const artifact = artifacts[index]!

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex(Math.max(0, index - 1))
      if (e.key === 'ArrowRight') setIndex(Math.min(artifacts.length - 1, index + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, artifacts.length, setIndex, onClose])

  useEffect(() => {
    setEditing(false)
    setInstruction('')
    setEditError('')
  }, [index])

  const handleSubmitEdit = async () => {
    if (!instruction.trim()) return
    setEditError('')
    setSubmitting(true)
    try {
      const updated = await api.editArtifact(generationRequestId, artifact.position, instruction.trim())
      onResultUpdate(updated)
      setInstruction('')
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erro ao editar o card.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
      >
        Fechar ✕
      </button>

      <button
        onClick={() => setIndex(Math.max(0, index - 1))}
        disabled={index === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30"
      >
        ←
      </button>
      <button
        onClick={() => setIndex(Math.min(artifacts.length - 1, index + 1))}
        disabled={index === artifacts.length - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-30"
      >
        →
      </button>

      <div className="flex max-h-full w-full max-w-md flex-col items-center gap-3">
        {artifact.status === 'ready' && artifact.imageStoragePath ? (
          <LightboxImage path={artifact.imageStoragePath} aspectClass={aspectClass} />
        ) : (
          <div className={`flex w-full max-w-md items-center justify-center rounded-lg bg-gray-800 text-sm text-gray-300 ${aspectClass}`}>
            {ARTIFACT_STATUS_LABELS[artifact.status]}
          </div>
        )}

        <p className="text-sm text-gray-300">
          #{artifact.position} de {artifacts.length}
        </p>

        <div className="w-full space-y-2">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              Editar este card
            </button>
          ) : (
            <div className="space-y-2 rounded-lg bg-white p-3">
              <p className="text-xs font-medium text-gray-600">
                Descreva o que você quer mudar neste card
              </p>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Ex: deixe o fundo mais claro, troque a pessoa por um ícone…"
                className="w-full resize-none rounded-lg border border-gray-300 p-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitEdit}
                  disabled={submitting || !instruction.trim()}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                >
                  {submitting ? 'Aplicando…' : 'Aplicar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
  const [style, setStyle] = useState<TemplateStyle>(TemplateStyle.BOLD_BOTTOM)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE)
  const [topicSuggestionId, setTopicSuggestionId] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
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

  useEffect(() => {
    setPhotoFiles((prev) => prev.slice(0, artifactCount))
  }, [artifactCount])

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const canGenerate = description.trim().length > 0 && selectedPlatforms.size > 0 && !generating

  const handlePhotoFilesAdd = (files: File[]) => {
    setPhotoFiles((prev) => [...prev, ...files].slice(0, artifactCount))
  }

  const handlePhotoFileRemove = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGenerate = async () => {
    setError('')
    setGenerating(true)
    try {
      const imageStoragePaths =
        photoFiles.length > 0 ? await Promise.all(photoFiles.map((f) => api.uploadImage(f))) : undefined
      const generationRequest = await api.generateContent({
        description: description.trim(),
        ...(textContent.trim() && { textContent: textContent.trim() }),
        targetPlatforms: [...selectedPlatforms],
        artifactCount,
        style,
        aspectRatio,
        ...(topicSuggestionId && { topicSuggestionId }),
        ...(imageStoragePaths && { imageStoragePaths }),
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
            <ResultView result={result} onResultUpdate={setResult} onBack={() => router.push('/dashboard')} />
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
              style={style}
              setStyle={setStyle}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              photoFiles={photoFiles}
              onPhotoFilesAdd={handlePhotoFilesAdd}
              onPhotoFileRemove={handlePhotoFileRemove}
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
              <Link href="/dashboard/brand" className="text-xs font-semibold text-brand-600 hover:underline">
                Editar marca →
              </Link>
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
  style,
  setStyle,
  aspectRatio,
  setAspectRatio,
  photoFiles,
  onPhotoFilesAdd,
  onPhotoFileRemove,
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
  style: TemplateStyle
  setStyle: (v: TemplateStyle) => void
  aspectRatio: AspectRatio
  setAspectRatio: (v: AspectRatio) => void
  photoFiles: File[]
  onPhotoFilesAdd: (files: File[]) => void
  onPhotoFileRemove: (index: number) => void
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
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {connectedPlatforms.filter((p) => !COMING_SOON_PLATFORMS.has(p)).map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    title={PLATFORM_MEDIA_NOTE[p]}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      selectedPlatforms.has(p)
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-brand-400'
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        selectedPlatforms.has(p) ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {PLATFORM_MEDIA_NOTE[p]}
                    </span>
                  </button>
                ))}
                {connectedPlatforms.filter((p) => COMING_SOON_PLATFORMS.has(p)).map((p) => (
                  <span
                    key={p}
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-gray-400"
                    title="Disponível em breve"
                  >
                    {PLATFORM_LABELS[p]}
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-500">
                      Em breve
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Instagram exige pelo menos uma imagem. Facebook aceita imagem, mas é opcional. LinkedIn e
                X (Twitter) publicam apenas o texto — fotos e cards gerados não são usados nessas redes.
              </p>
              {connectedPlatforms.some((p) => COMING_SOON_PLATFORMS.has(p)) && (
                <p className="text-xs text-gray-400">
                  * A publicação via X (Twitter) estará disponível em breve. A API do X requer plano pago
                  para envio de posts.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Quantidade de artefatos
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-gray-300">
              <button
                type="button"
                onClick={() => setArtifactCount(Math.max(1, artifactCount - 1))}
                disabled={artifactCount <= 1}
                aria-label="Diminuir quantidade"
                className="px-3 py-2 text-base font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={artifactCount}
                onChange={(e) => setArtifactCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                className="w-12 border-x border-gray-300 px-2 py-2 text-center text-sm text-gray-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setArtifactCount(Math.min(10, artifactCount + 1))}
                disabled={artifactCount >= 10}
                aria-label="Aumentar quantidade"
                className="px-3 py-2 text-base font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {artifactCount === 1 ? 'Post único' : `Carrossel com ${artifactCount} imagens`}
            </p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Suas fotos (opcional)
          </label>
          <p className="mb-2 text-xs text-gray-400">
            Envie até {artifactCount} foto{artifactCount > 1 ? 's' : ''} sua{artifactCount > 1 ? 's' : ''} para
            usar como fundo dos cards — a IA só monta o template (texto e logo) sobre elas, sem gerar uma imagem
            nova. Cards sem foto enviada continuam usando imagem gerada por IA. Válido apenas para Instagram e
            Facebook — LinkedIn e X publicam somente o texto gerado.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => {
              onPhotoFilesAdd(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
            disabled={photoFiles.length >= artifactCount}
            className="block w-full text-sm text-gray-600"
          />
          {photoFiles.length > 0 && (
            <ul className="mt-2 space-y-1">
              {photoFiles.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600"
                >
                  <span className="truncate">
                    #{i + 1} — {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPhotoFileRemove(i)}
                    className="ml-2 shrink-0 text-red-500 hover:text-red-700"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Estilo do template
          </label>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATE_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStyle(option.value)}
                className={`space-y-2 rounded-lg border p-2 text-left transition-colors ${
                  style === option.value
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-gray-300 bg-white hover:border-brand-400'
                }`}
              >
                <div className="flex aspect-square w-full flex-col overflow-hidden rounded bg-gray-200">
                  {option.value === TemplateStyle.TOP_STRIP && (
                    <div className="h-1/5 w-full bg-brand-300" />
                  )}
                  {option.value === TemplateStyle.CENTERED_OVERLAY && (
                    <div className="flex h-full w-full items-center justify-center bg-black/40">
                      <div className="h-1/4 w-2/3 rounded bg-white/70" />
                    </div>
                  )}
                  {option.value === TemplateStyle.BOLD_BOTTOM && <div className="flex-1" />}
                  {option.value === TemplateStyle.BOLD_BOTTOM && (
                    <div className="h-1/4 w-full bg-brand-300" />
                  )}
                </div>
                <p
                  className={`text-xs font-medium ${
                    style === option.value ? 'text-brand-700' : 'text-gray-600'
                  }`}
                >
                  {option.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Formato da imagem
          </label>
          <div className="grid grid-cols-4 gap-3">
            {ASPECT_RATIO_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setAspectRatio(option.value)}
                className={`space-y-2 rounded-lg border p-2 text-left transition-colors ${
                  aspectRatio === option.value
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-gray-300 bg-white hover:border-brand-400'
                }`}
              >
                <div className={`mx-auto w-full rounded bg-gray-200 ${option.preview}`} />
                <p
                  className={`text-center text-xs font-medium ${
                    aspectRatio === option.value ? 'text-brand-700' : 'text-gray-600'
                  }`}
                >
                  {option.label}
                </p>
              </button>
            ))}
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

function ResultView({
  result,
  onResultUpdate,
  onBack,
}: {
  result: ApiGenerationRequest
  onResultUpdate: (r: ApiGenerationRequest) => void
  onBack: () => void
}) {
  const aspectClass = ASPECT_RATIO_CLASS[result.inputs.aspectRatio]
  const readyArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'ready') ?? []
  const failedArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'failed') ?? []
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null)
  const [publishError, setPublishError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
            {result.outputs?.artifacts.map((artifact, i) => (
              <div key={artifact.position} className="space-y-1">
                {artifact.status === 'ready' && artifact.imageStoragePath ? (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="block w-full cursor-zoom-in"
                  >
                    <GeneratedImage path={artifact.imageStoragePath} aspectClass={aspectClass} />
                  </button>
                ) : (
                  <div
                    className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2 text-center text-xs text-gray-400 ${aspectClass}`}
                  >

                    <span>{ARTIFACT_STATUS_LABELS[artifact.status]}</span>
                    {artifact.error && (
                      <span className="break-words text-red-600">{artifact.error}</span>
                    )}
                  </div>
                )}
                <p className="text-center text-xs text-gray-400">#{artifact.position}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {lightboxIndex !== null && result.outputs && (
        <Lightbox
          artifacts={result.outputs.artifacts}
          aspectClass={aspectClass}
          index={lightboxIndex}
          setIndex={setLightboxIndex}
          generationRequestId={result.id}
          onResultUpdate={onResultUpdate}
          onClose={() => setLightboxIndex(null)}
        />
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
