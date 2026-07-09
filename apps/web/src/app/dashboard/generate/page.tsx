'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api, type ApiGenerationRequest, type PublishResponse } from '../../../lib/api'
import { useWakeLock } from '../../../lib/useWakeLock'
import {
  Platform,
  PLATFORM_MEDIA_SUPPORT,
  PLATFORM_CHARACTER_LIMITS,
  TemplateStyle,
  AspectRatio,
  MAX_GENERATION_ARTIFACTS,
  type GenerationArtifact,
} from '@socialshelf/domain'
import { Stepper } from '../../../components/Stepper'
import { RecommendationPanel } from '../../../components/RecommendationPanel'
import { ScoreBadge } from '../../../components/ScoreBadge'
import { PerformanceSuggestionsPanel } from '../../../components/PerformanceSuggestionsPanel'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
}

const ARTIFACT_STATUS_LABELS: Record<string, string> = {
  pending: 'Na fila',
  generating: 'Gerando…',
  ready: 'Pronto',
  failed: 'Falhou',
}

const STEPS = ['Descrever', 'Gerando', 'Resultado']

const COMING_SOON_PLATFORMS = new Set<Platform>([Platform.TWITTER])

// TikTok não se encaixa na régua imagem/texto das outras plataformas: a IA gera a legenda
// aqui, mas o vídeo em si ainda precisa ser enviado depois em /dashboard/compose (geração de
// vídeo por IA ainda não existe) — "Apenas texto" seria enganoso, já que texto puro nunca é
// aceito pelo TikTok.
const PLATFORM_MEDIA_NOTE: Record<Platform, string> = Object.fromEntries(
  Object.values(Platform).map((p) => [
    p,
    p === Platform.TIKTOK
      ? 'Legenda com IA — vídeo é enviado depois'
      : PLATFORM_MEDIA_SUPPORT[p].requiresImage
        ? 'Exige imagem'
        : PLATFORM_MEDIA_SUPPORT[p].supportsImage
          ? 'Aceita imagem'
          : 'Apenas texto',
  ]),
) as Record<Platform, string>

function truncateForPlatform(text: string, platform: Platform): string {
  const limit = PLATFORM_CHARACTER_LIMITS[platform]
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trimEnd()}…`
}

const TEMPLATE_STYLE_OPTIONS: Array<{ value: TemplateStyle; label: string }> = [
  { value: TemplateStyle.NO_TEXT, label: 'Sem texto' },
  { value: TemplateStyle.BOLD_BOTTOM, label: 'Faixa inferior' },
  { value: TemplateStyle.CENTERED_OVERLAY, label: 'Overlay escuro' },
  { value: TemplateStyle.TOP_STRIP, label: 'Faixa superior' },
]

// "Stories" (9:16) is intentionally not offered: the publisher only posts to
// the Instagram feed, and a 9:16 image falls outside Instagram's feed aspect
// ratio range (0.8–1.91), so Meta crops it on publish.
const ASPECT_RATIO_OPTIONS: Array<{ value: AspectRatio; label: string; preview: string }> = [
  { value: AspectRatio.SQUARE, label: 'Quadrado', preview: 'aspect-square' },
  { value: AspectRatio.PORTRAIT, label: 'Retrato', preview: 'aspect-[3/4]' },
  { value: AspectRatio.LANDSCAPE, label: 'Paisagem', preview: 'aspect-video' },
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
      <div className={`flex w-full items-center justify-center rounded-lg bg-card-2 ${aspectClass}`}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (isError || !url) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-card-2 p-2 text-center text-xs text-muted ${aspectClass}`}
      >
        <span>Não foi possível carregar a imagem</span>
        {error instanceof Error && <span className="break-words text-red-600">{error.message}</span>}
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Artefato gerado" className={`w-full rounded-lg object-cover ${aspectClass}`} />
}

function GeneratedVideo({ path }: { path: string }) {
  const { data: url, isLoading, isError, error } = useQuery({
    queryKey: ['generated-video-url', path],
    queryFn: () => api.getVideoUrl(path),
  })

  if (isLoading) {
    return (
      <div className="flex aspect-[9/16] w-full max-w-xs items-center justify-center rounded-lg bg-card-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (isError || !url) {
    return (
      <div className="flex aspect-[9/16] w-full max-w-xs flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-card-2 p-2 text-center text-xs text-muted">
        <span>Não foi possível carregar o vídeo</span>
        {error instanceof Error && <span className="break-words text-red-600">{error.message}</span>}
      </div>
    )
  }

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video src={url} controls className="aspect-[9/16] w-full max-w-xs rounded-lg bg-black" />
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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Artefato gerado"
      className={`max-h-[70vh] w-full max-w-md rounded-lg object-contain ${aspectClass}`}
    />
  )
}

function Lightbox({
  artifacts,
  headlines,
  bodyTexts,
  aspectClass,
  index,
  setIndex,
  generationRequestId,
  onResultUpdate,
  onClose,
}: {
  artifacts: GenerationArtifact[]
  headlines: string[] | null
  bodyTexts: string[] | null
  aspectClass: string
  index: number
  setIndex: (i: number) => void
  generationRequestId: string
  onResultUpdate: (r: ApiGenerationRequest) => void
  onClose: () => void
}) {
  const [editMode, setEditMode] = useState<'menu' | 'instruction' | 'text'>('menu')
  const [instruction, setInstruction] = useState('')
  const [headlineInput, setHeadlineInput] = useState('')
  const [bodyInput, setBodyInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  const artifact = artifacts[index]!
  const canEditText = artifact.backgroundImageStoragePath !== null

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
    setEditMode('menu')
    setInstruction('')
    setHeadlineInput(headlines?.[index] ?? '')
    setBodyInput(bodyTexts?.[index] ?? '')
    setEditError('')
  }, [index, headlines, bodyTexts])

  const handleSubmitEdit = async () => {
    if (!instruction.trim()) return
    setEditError('')
    setSubmitting(true)
    try {
      const updated = await api.editArtifact(generationRequestId, artifact.position, instruction.trim())
      onResultUpdate(updated)
      setInstruction('')
      setEditMode('menu')
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erro ao editar o card.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitTextEdit = async () => {
    if (!headlineInput.trim()) return
    setEditError('')
    setSubmitting(true)
    try {
      const updated = await api.editArtifactText(
        generationRequestId,
        artifact.position,
        headlineInput.trim(),
        bodyInput.trim() ? bodyInput.trim() : null,
      )
      onResultUpdate(updated)
      setEditMode('menu')
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erro ao editar o texto do card.')
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

        <p className="text-sm text-white/70">
          #{artifact.position} de {artifacts.length}
        </p>

        <div className="w-full space-y-2">
          {editMode === 'menu' && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode('text')}
                disabled={!canEditText}
                title={!canEditText ? 'Este card foi gerado antes deste recurso e não pode ter o texto editado diretamente' : undefined}
                className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-30"
              >
                Editar texto
              </button>
              <button
                onClick={() => setEditMode('instruction')}
                className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Editar com IA
              </button>
            </div>
          )}

          {editMode === 'text' && (
            <div className="space-y-2 rounded-lg bg-card p-3">
              <p className="text-xs font-medium text-muted">Edite o título e o texto de apoio deste card</p>
              <input
                value={headlineInput}
                onChange={(e) => setHeadlineInput(e.target.value)}
                autoFocus
                placeholder="Título"
                className="w-full rounded-lg border border-line p-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                value={bodyInput}
                onChange={(e) => setBodyInput(e.target.value)}
                rows={2}
                placeholder="Texto de apoio (opcional)"
                className="w-full resize-none rounded-lg border border-line p-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditMode('menu')}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitTextEdit}
                  disabled={submitting || !headlineInput.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? 'Aplicando…' : 'Aplicar'}
                </button>
              </div>
            </div>
          )}

          {editMode === 'instruction' && (
            <div className="space-y-2 rounded-lg bg-card p-3">
              <p className="text-xs font-medium text-muted">
                Descreva o que você quer mudar neste card
              </p>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Ex: deixe o fundo mais claro, troque a pessoa por um ícone…"
                className="w-full resize-none rounded-lg border border-line p-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditMode('menu')}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitEdit}
                  disabled={submitting || !instruction.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
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

function useGenerationProgress(active: boolean, knownArtifactCount: number | null) {
  const stages = [
    'Lendo a voz da marca…',
    'Escrevendo a copy e decidindo a estrutura do post…',
    ...(knownArtifactCount
      ? Array.from({ length: knownArtifactCount }, (_, i) => `Criando o card ${i + 1} de ${knownArtifactCount}…`)
      : ['Criando as imagens dos cards…']),
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

const DRAFT_STORAGE_KEY = 'socialshelf:generate-draft'

type GenerateDraft = {
  description: string
  textContent: string
  selectedPlatforms: Platform[]
  style: TemplateStyle
  aspectRatio: AspectRatio
  topicSuggestionId: string
  includeBodyText: boolean
}

function loadDraft(): GenerateDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GenerateDraft) : null
  } catch {
    return null
  }
}

export default function GenerateContentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draft = loadDraft()
  const [description, setDescription] = useState(() => searchParams.get('seed') ?? draft?.description ?? '')
  const [textContent, setTextContent] = useState(() => draft?.textContent ?? '')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(
    () => new Set(draft?.selectedPlatforms ?? []),
  )
  const [style, setStyle] = useState<TemplateStyle>(() => draft?.style ?? TemplateStyle.NO_TEXT)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => draft?.aspectRatio ?? AspectRatio.SQUARE)
  const [topicSuggestionId, setTopicSuggestionId] = useState(() => draft?.topicSuggestionId ?? '')
  const [includeBodyText, setIncludeBodyText] = useState(() => draft?.includeBodyText ?? false)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ApiGenerationRequest | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const data: GenerateDraft = {
      description,
      textContent,
      selectedPlatforms: [...selectedPlatforms],
      style,
      aspectRatio,
      topicSuggestionId,
      includeBodyText,
    }
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data))
  }, [description, textContent, selectedPlatforms, style, aspectRatio, topicSuggestionId, includeBodyText])

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

  const { stages, stageIndex } = useGenerationProgress(generating, photoFiles.length > 0 ? photoFiles.length : null)
  useWakeLock(generating)

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

  const handlePhotoFilesAdd = (files: File[]) => {
    setPhotoFiles((prev) => [...prev, ...files].slice(0, MAX_GENERATION_ARTIFACTS))
  }

  const handlePhotoFileRemove = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClear = () => {
    setDescription('')
    setTextContent('')
    setSelectedPlatforms(new Set())
    setStyle(TemplateStyle.NO_TEXT)
    setAspectRatio(AspectRatio.SQUARE)
    setTopicSuggestionId('')
    setIncludeBodyText(false)
    setPhotoFiles([])
    setError('')
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
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
        style,
        aspectRatio,
        ...(topicSuggestionId && { topicSuggestionId }),
        ...(imageStoragePaths && { imageStoragePaths }),
        ...(includeBodyText && { includeBodyText }),
      })
      setResult(generationRequest)
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      // Gerar conteúdo é uma chamada longa (copy + todas as imagens antes de responder) —
      // "Load failed"/"Failed to fetch" é o erro genérico do navegador quando a conexão cai
      // no meio dessa espera, mesmo padrão já visto no upload/composição de vídeo do TikTok.
      setError(
        /load failed|failed to fetch|networkerror/i.test(raw)
          ? 'Falha de rede durante a geração — sua conexão pode ter caído no meio da espera. Tente novamente numa rede mais estável.'
          : raw || 'Erro ao gerar conteúdo.',
      )
    } finally {
      setGenerating(false)
    }
  }

  const currentStep = result ? 2 : generating ? 1 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Gerar Conteúdo com IA</h1>
      </div>

      <Stepper steps={STEPS} currentStep={currentStep} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {result ? (
            <ResultView
              result={result}
              onResultUpdate={setResult}
              onBack={() => router.push('/dashboard')}
              sourceArticleUrl={selectedSuggestion?.articleUrl ?? null}
              connectedPlatforms={connectedPlatforms}
            />
          ) : generating ? (
            <GeneratingView stages={stages} stageIndex={stageIndex} />
          ) : (
            <>
              <PerformanceSuggestionsPanel onUseSuggestion={setDescription} />
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
              style={style}
              setStyle={setStyle}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              includeBodyText={includeBodyText}
              setIncludeBodyText={setIncludeBodyText}
              photoFiles={photoFiles}
              onPhotoFilesAdd={handlePhotoFilesAdd}
              onPhotoFileRemove={handlePhotoFileRemove}
              error={error}
              canGenerate={canGenerate}
              onGenerate={handleGenerate}
                onClear={handleClear}
              />
            </>
          )}
        </div>

        <RecommendationPanel>
          {brandProfile ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">{brandProfile.business.name}</p>
              <p className="text-xs text-muted">
                Tom de voz: <span className="font-medium text-ink">{brandProfile.voice.tone}</span>
              </p>
              <p className="text-xs text-muted">
                A copy gerada vai seguir esse tom automaticamente.
              </p>
              <Link href="/dashboard/brand" className="text-xs font-semibold text-accent hover:underline">
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
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-sm font-medium text-ink">{selectedSuggestion.headline}</p>
              <ScoreBadge label="Aderência ao público" score={selectedSuggestion.audienceFitScore} />
              <p className="text-xs text-muted">{selectedSuggestion.rationale}</p>
            </div>
          )}

          {result?.outputs?.cta && (
            <div className="space-y-1 border-t border-line pt-3">
              <p className="text-sm font-medium text-ink">CTA sugerido</p>
              <p className="text-xs text-muted">{result.outputs.cta}</p>
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
  style,
  setStyle,
  aspectRatio,
  setAspectRatio,
  includeBodyText,
  setIncludeBodyText,
  photoFiles,
  onPhotoFilesAdd,
  onPhotoFileRemove,
  error,
  canGenerate,
  onGenerate,
  onClear,
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
  style: TemplateStyle
  setStyle: (v: TemplateStyle) => void
  aspectRatio: AspectRatio
  setAspectRatio: (v: AspectRatio) => void
  includeBodyText: boolean
  setIncludeBodyText: (v: boolean) => void
  photoFiles: File[]
  onPhotoFilesAdd: (files: File[]) => void
  onPhotoFileRemove: (index: number) => void
  error: string
  canGenerate: boolean
  onGenerate: () => void
  onClear: () => void
}) {
  return (
    <>
      <section className="space-y-4 rounded-2xl border border-line bg-card p-5 shadow-card">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            Descreva o que você quer publicar
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Ex: Lançamento da nova funcionalidade de relatórios automáticos…"
            className="w-full resize-none rounded-lg border border-line p-3 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            Texto-base (opcional)
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={2}
            placeholder="Cole um rascunho ou referência para a IA usar como ponto de partida…"
            className="w-full resize-none rounded-lg border border-line p-3 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {suggestions && suggestions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              Pauta sugerida (opcional)
            </label>
            <select
              value={topicSuggestionId}
              onChange={(e) => setTopicSuggestionId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
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
          <label className="mb-1.5 block text-sm font-semibold text-ink">Plataformas</label>
          {loadingConnections ? (
            <p className="text-sm text-muted">Carregando conexões…</p>
          ) : connectedPlatforms.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma plataforma conectada.{' '}
              <a href="/dashboard" className="text-accent underline">
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
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-card text-muted hover:border-accent'
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        selectedPlatforms.has(p) ? 'bg-white/20 text-accent-ink' : 'bg-card-2 text-muted'
                      }`}
                    >
                      {PLATFORM_MEDIA_NOTE[p]}
                    </span>
                  </button>
                ))}
                {connectedPlatforms.filter((p) => COMING_SOON_PLATFORMS.has(p)).map((p) => (
                  <span
                    key={p}
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-line bg-card-2 px-3 py-1 text-sm font-medium text-muted"
                    title="Disponível em breve"
                  >
                    {PLATFORM_LABELS[p]}
                    <span className="rounded-full bg-card-2 px-1.5 py-0.5 text-xs font-semibold text-muted">
                      Em breve
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted">
                Instagram exige pelo menos uma imagem. Facebook aceita imagem, mas é opcional. LinkedIn e
                X (Twitter) publicam apenas o texto — fotos e cards gerados não são usados nessas redes.
              </p>
              {connectedPlatforms.some((p) => COMING_SOON_PLATFORMS.has(p)) && (
                <p className="text-xs text-muted">
                  * A publicação via X (Twitter) estará disponível em breve. A API do X requer plano pago
                  para envio de posts.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            Suas fotos (opcional)
          </label>
          <p className="mb-2 text-xs text-muted">
            A IA decide, a partir do que você descreveu, quantos cards o post precisa e gera as imagens de
            fundo — você não escolhe a quantidade. Se preferir usar fotos próprias em vez de imagens geradas,
            envie até {MAX_GENERATION_ARTIFACTS}: a quantidade enviada passa a ser exatamente a quantidade de
            cards do post, e a IA só monta o template (texto e logo) sobre elas. Válido apenas para Instagram e
            Facebook — LinkedIn e X publicam somente o texto gerado.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              onPhotoFilesAdd(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
            disabled={photoFiles.length >= MAX_GENERATION_ARTIFACTS}
            className="block w-full text-sm text-muted"
          />
          {photoFiles.length > 0 && (
            <>
              <p className="mt-2 text-xs font-medium text-accent">
                {photoFiles.length === 1 ? 'Post único' : `Carrossel com ${photoFiles.length} cards`} — definido
                pela quantidade de fotos enviadas.
              </p>
              <ul className="mt-2 space-y-1">
                {photoFiles.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between rounded-lg bg-card-2 px-3 py-1.5 text-xs text-muted"
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
            </>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">
            Estilo do template
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TEMPLATE_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStyle(option.value)}
                className={`space-y-2 rounded-lg border p-2 text-left transition-colors ${
                  style === option.value
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-card hover:border-accent'
                }`}
              >
                <div className="flex aspect-square w-full flex-col overflow-hidden rounded bg-card-2">
                  {option.value === TemplateStyle.TOP_STRIP && (
                    <div className="h-1/3 w-full bg-gradient-to-b from-accent to-transparent" />
                  )}
                  {option.value === TemplateStyle.CENTERED_OVERLAY && (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex h-1/3 w-full items-center justify-center bg-black/40">
                        <div className="h-1/3 w-2/3 rounded bg-white/70" />
                      </div>
                    </div>
                  )}
                  {option.value === TemplateStyle.BOLD_BOTTOM && (
                    <div className="mt-auto h-1/3 w-full bg-gradient-to-t from-accent to-transparent" />
                  )}
                </div>
                <p
                  className={`text-xs font-medium ${
                    style === option.value ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {option.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {style !== TemplateStyle.NO_TEXT && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={includeBodyText}
                onChange={(e) => setIncludeBodyText(e.target.checked)}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              Incluir texto de apoio (parágrafo curto abaixo do headline)
            </label>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink">
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
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-card hover:border-accent'
                }`}
              >
                <div className={`mx-auto w-full rounded bg-card-2 ${option.preview}`} />
                <p
                  className={`text-center text-xs font-medium ${
                    aspectRatio === option.value ? 'text-accent' : 'text-muted'
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

      <div className="flex items-center gap-3">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
        >
          Gerar Conteúdo
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-muted hover:bg-card-2"
        >
          Limpar
        </button>
      </div>
    </>
  )
}

function GeneratingView({ stages, stageIndex }: { stages: string[]; stageIndex: number }) {
  return (
    <section className="space-y-4 rounded-2xl border border-accent-soft bg-card p-6 shadow-card">
      <ol className="space-y-3">
        {stages.map((stage, i) => {
          const isCurrent = i === stageIndex
          const isPast = i < stageIndex
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isCurrent ? 'animate-pulse bg-accent' : isPast ? 'bg-accent-soft' : 'bg-card-2'
                }`}
              />
              <span className={`text-sm ${isCurrent ? 'font-medium text-ink' : 'text-muted'}`}>
                {stage}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-muted">
        Isso pode levar até 2 minutos, especialmente para carrosséis com várias imagens. Não saia desta página.
      </p>
    </section>
  )
}

function ResultView({
  result,
  onResultUpdate,
  onBack,
  sourceArticleUrl,
  connectedPlatforms,
}: {
  result: ApiGenerationRequest
  onResultUpdate: (r: ApiGenerationRequest) => void
  onBack: () => void
  sourceArticleUrl: string | null
  connectedPlatforms: Platform[]
}) {
  const aspectClass = ASPECT_RATIO_CLASS[result.inputs.aspectRatio]
  const readyArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'ready') ?? []
  const failedArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'failed') ?? []
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null)
  const [publishError, setPublishError] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduledAtInput, setScheduledAtInput] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduleSuccess, setScheduleSuccess] = useState<Date | null>(null)
  const [selectedExtraPlatforms, setSelectedExtraPlatforms] = useState<Set<Platform>>(new Set())
  const [extraUsedPlatforms, setExtraUsedPlatforms] = useState<Set<Platform>>(new Set())
  const [extraResults, setExtraResults] = useState<PublishResponse['results']>([])
  const [extraFailed, setExtraFailed] = useState<PublishResponse['failedPlatforms']>([])
  const [extraPublishing, setExtraPublishing] = useState(false)
  const [extraPublishError, setExtraPublishError] = useState('')
  const [composingVideo, setComposingVideo] = useState(false)
  const [composedVideoPath, setComposedVideoPath] = useState<string | null>(null)
  const [composeVideoError, setComposeVideoError] = useState('')
  const [narrateVideo, setNarrateVideo] = useState(false)

  // _local-adr-policy-037: o texto narrado vem da legenda de TikTok já gerada pela IA, nunca
  // de um campo de texto livre novo — narração só é possível quando essa legenda existe.
  const tiktokCaptionForNarration = result.outputs?.copies[Platform.TIKTOK]?.text ?? null

  // Experimental: monta um vídeo animado (slideshow com Ken Burns) a partir das imagens já
  // geradas, com narração por IA opcional — ação avulsa e opt-in, não parte do fluxo normal
  // de publicação.
  const handleComposeVideo = async () => {
    setComposeVideoError('')
    setComposedVideoPath(null)
    setComposingVideo(true)
    try {
      const { path } = await api.composeSlideshow(
        result.id,
        readyArtifacts.map((a) => a.imageStoragePath!),
        narrateVideo && tiktokCaptionForNarration ? tiktokCaptionForNarration : undefined,
      )
      setComposedVideoPath(path)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      // "Load failed"/"Failed to fetch" são os erros genéricos que o navegador dá quando a
      // conexão cai no meio de uma requisição longa (mesmo padrão já visto no upload de vídeo
      // do TikTok) — a composição de várias imagens pode levar um tempo em redes mais fracas.
      setComposeVideoError(
        /load failed|failed to fetch|networkerror/i.test(raw)
          ? 'Falha de rede ao gerar o vídeo — tente novamente ou com menos imagens, numa rede mais estável.'
          : raw,
      )
    } finally {
      setComposingVideo(false)
    }
  }

  const [publishingTikTokVideo, setPublishingTikTokVideo] = useState(false)
  const [tiktokVideoPublishResult, setTiktokVideoPublishResult] = useState<PublishResponse | null>(null)
  const [tiktokVideoPublishError, setTiktokVideoPublishError] = useState('')
  // Mantém a tela acesa durante qualquer espera longa nesta tela — gerar/testar vídeo,
  // publicar, agendar, ou publicar o vídeo no TikTok.
  useWakeLock(composingVideo || publishing || scheduling || extraPublishing || publishingTikTokVideo)

  // Publica o vídeo já composto e testado acima, com a legenda de TikTok já gerada pela IA.
  // videoConsentAcceptedAt fica null de propósito: o checkbox de consentimento de
  // _local-edr-policy-034 é sobre vídeo enviado pelo usuário com conteúdo de terceiros — aqui
  // o vídeo é composição da própria IA a partir de imagens já geradas pelo pipeline.
  const handlePublishTikTokVideo = async () => {
    if (!composedVideoPath) return
    const tiktokCopy = result.outputs?.copies[Platform.TIKTOK]
    if (!tiktokCopy) return

    setTiktokVideoPublishError('')
    setPublishingTikTokVideo(true)
    try {
      const post = await api.createPost(
        [{ platform: Platform.TIKTOK, text: tiktokCopy.text }],
        [],
        undefined,
        sourceArticleUrl,
        composedVideoPath,
        null,
      )
      const response = await api.publishPost(post.id)
      setTiktokVideoPublishResult(response)
    } catch (err) {
      setTiktokVideoPublishError(err instanceof Error ? err.message : 'Erro ao publicar no TikTok.')
    } finally {
      setPublishingTikTokVideo(false)
    }
  }

  // TikTok fica de fora do publicar/agendar direto desta tela: não há upload de vídeo aqui,
  // e o TikTok não aceita post sem vídeo — a legenda gerada fica disponível para uso manual
  // em /dashboard/compose, onde o vídeo é anexado antes de publicar.
  const buildContent = () => {
    if (!result.outputs) return []
    return Object.entries(result.outputs.copies)
      .filter(([platform]) => platform !== Platform.TIKTOK)
      .map(([platform, copy]) => ({
        platform: platform as Platform,
        text: copy!.text,
      }))
  }

  const handlePublish = async () => {
    if (!result.outputs) return
    setPublishError('')
    setPublishing(true)
    try {
      const post = await api.createPost(
        buildContent(),
        readyArtifacts.map((a) => a.imageStoragePath!),
        undefined,
        sourceArticleUrl,
      )
      const response = await api.publishPost(post.id)
      setPublishResult(response)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Erro ao publicar.')
    } finally {
      setPublishing(false)
    }
  }

  const handleSchedule = async () => {
    if (!result.outputs || !scheduledAtInput) return
    const scheduledAt = new Date(scheduledAtInput)
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      setPublishError('Escolha uma data e hora no futuro.')
      return
    }
    setPublishError('')
    setScheduling(true)
    try {
      await api.createPost(buildContent(), readyArtifacts.map((a) => a.imageStoragePath!), scheduledAt, sourceArticleUrl)
      setScheduleSuccess(scheduledAt)
      setShowScheduler(false)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Erro ao agendar.')
    } finally {
      setScheduling(false)
    }
  }

  const usedPlatforms = new Set<Platform>([
    ...Object.keys(result.outputs?.copies ?? {}).map((p) => p as Platform),
    ...extraUsedPlatforms,
  ])
  // TikTok fica de fora deste atalho: "publicar também em" não tem etapa de upload de vídeo,
  // e o TikTok não aceita post sem vídeo — precisa passar por /dashboard/compose.
  const availableExtraPlatforms = connectedPlatforms.filter(
    (p) => !usedPlatforms.has(p) && !COMING_SOON_PLATFORMS.has(p) && p !== Platform.TIKTOK,
  )
  const sourceTextForExtra = (() => {
    const texts = Object.values(result.outputs?.copies ?? {}).map((c) => c!.text)
    return texts.reduce((longest, t) => (t.length > longest.length ? t : longest), texts[0] ?? '')
  })()

  const toggleExtraPlatform = (p: Platform) => {
    setSelectedExtraPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const handlePublishMore = async () => {
    if (selectedExtraPlatforms.size === 0) return
    setExtraPublishError('')
    setExtraPublishing(true)
    try {
      const content = [...selectedExtraPlatforms].map((platform) => ({
        platform,
        text: truncateForPlatform(sourceTextForExtra, platform),
      }))
      const post = await api.createPost(
        content,
        readyArtifacts.map((a) => a.imageStoragePath!),
        undefined,
        sourceArticleUrl,
      )
      const response = await api.publishPost(post.id)
      setExtraResults((prev) => [...prev, ...response.results])
      setExtraFailed((prev) => [...prev, ...response.failedPlatforms])
      setExtraUsedPlatforms((prev) => new Set([...prev, ...selectedExtraPlatforms]))
      setSelectedExtraPlatforms(new Set())
    } catch (err) {
      setExtraPublishError(err instanceof Error ? err.message : 'Erro ao publicar nas redes adicionais.')
    } finally {
      setExtraPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink">Resultado da Geração</h2>

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
          <h2 className="text-sm font-semibold text-ink">Copy gerada</h2>
          {Object.entries(result.outputs.copies).map(([platform, copy]) => (
            <div key={platform} className="rounded-xl border border-line bg-card p-4 shadow-card">
              <p className="mb-2 text-sm font-medium text-ink">
                {PLATFORM_LABELS[platform as Platform]}
              </p>
              <p className="whitespace-pre-wrap text-sm text-ink">{copy?.text}</p>
              {platform === Platform.TIKTOK && (
                <p className="mt-2 text-xs text-muted">
                  Esta legenda não é publicada pelo botão &quot;Publicar&quot; acima — gere o vídeo
                  animado mais abaixo para publicar com ela, ou abra{' '}
                  <Link href="/dashboard/compose" className="underline">
                    Novo Post
                  </Link>{' '}
                  para usar um vídeo próprio.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {(readyArtifacts.length > 0 || failedArtifacts.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">
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
                    className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-card-2 p-2 text-center text-xs text-muted ${aspectClass}`}
                  >

                    <span>{ARTIFACT_STATUS_LABELS[artifact.status]}</span>
                    {artifact.error && (
                      <span className="break-words text-red-600">{artifact.error}</span>
                    )}
                  </div>
                )}
                <p className="text-center text-xs text-muted">#{artifact.position}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {readyArtifacts.length > 0 && (
        <section className="space-y-3 rounded-xl border border-dashed border-accent/50 bg-card p-4">
          <div>
            <p className="text-sm font-semibold text-ink">🎬 Vídeo animado (experimental)</p>
            <p className="text-xs text-muted">
              Monta um vídeo a partir das imagens acima, cada uma com um leve efeito de zoom.
              Depois de gerado, você pode publicar direto no TikTok com ele.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={narrateVideo}
              disabled={!tiktokCaptionForNarration}
              onChange={(e) => setNarrateVideo(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Narrar com voz de IA
              {tiktokCaptionForNarration ? (
                <span className="block text-xs text-muted">
                  A IA lê a legenda do TikTok em voz alta; a duração do vídeo passa a seguir a
                  narração, não mais 3s por imagem.
                </span>
              ) : (
                <span className="block text-xs text-muted">
                  Selecione TikTok como plataforma na geração para poder narrar (a narração usa a
                  legenda já gerada).
                </span>
              )}
            </span>
          </label>
          <button
            type="button"
            onClick={handleComposeVideo}
            disabled={composingVideo}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50"
          >
            {composingVideo ? 'Gerando vídeo…' : 'Gerar vídeo de teste'}
          </button>
          {composeVideoError && <p className="text-sm text-red-600">{composeVideoError}</p>}
          {composedVideoPath && <GeneratedVideo path={composedVideoPath} />}

          {composedVideoPath && (
            <div className="space-y-2 border-t border-line pt-3">
              {result.outputs?.copies[Platform.TIKTOK] ? (
                <>
                  <button
                    type="button"
                    onClick={handlePublishTikTokVideo}
                    disabled={publishingTikTokVideo || !!tiktokVideoPublishResult}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {publishingTikTokVideo ? 'Publicando…' : 'Publicar no TikTok com este vídeo'}
                  </button>
                  {tiktokVideoPublishError && (
                    <p className="text-sm text-red-600">{tiktokVideoPublishError}</p>
                  )}
                  {tiktokVideoPublishResult && (
                    <>
                      {tiktokVideoPublishResult.results.length > 0 && (
                        <p className="text-sm font-medium text-green-700">
                          ✓ Publicado com sucesso no TikTok.
                        </p>
                      )}
                      {tiktokVideoPublishResult.failedPlatforms.length > 0 && (
                        <p className="text-sm text-red-700">
                          ✗ Falhou: {tiktokVideoPublishResult.failedPlatforms[0]?.reason}
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted">
                  Selecione TikTok como plataforma na geração para ter uma legenda pronta e poder
                  publicar este vídeo diretamente.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {lightboxIndex !== null && result.outputs && (
        <Lightbox
          artifacts={result.outputs.artifacts}
          headlines={result.outputs.headlines}
          bodyTexts={result.outputs.bodyTexts}
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
          {[...publishResult.results, ...extraResults].length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="mb-2 font-semibold text-green-800">Publicado com sucesso:</p>
              <ul className="space-y-1">
                {[...publishResult.results, ...extraResults].map((r) => (
                  <li key={r.platform} className="text-sm text-green-700">
                    ✓ {PLATFORM_LABELS[r.platform]}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {[...publishResult.failedPlatforms, ...extraFailed].length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-2 font-semibold text-red-800">Falhou:</p>
              <ul className="space-y-1">
                {[...publishResult.failedPlatforms, ...extraFailed].map((f) => (
                  <li key={f.platform} className="text-sm text-red-700">
                    ✗ {PLATFORM_LABELS[f.platform]} — {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {availableExtraPlatforms.length > 0 && (
            <div className="space-y-3 rounded-xl border border-line bg-card p-4 shadow-card">
              <p className="text-sm font-semibold text-ink">Publicar também em:</p>
              <div className="flex flex-wrap gap-2">
                {availableExtraPlatforms.map((p) => {
                  const blockedByImage = PLATFORM_MEDIA_SUPPORT[p].requiresImage && readyArtifacts.length === 0
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => !blockedByImage && toggleExtraPlatform(p)}
                      disabled={blockedByImage}
                      title={blockedByImage ? 'Exige imagem — este post não tem imagem.' : PLATFORM_MEDIA_NOTE[p]}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedExtraPlatforms.has(p)
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-line bg-card text-muted hover:border-accent'
                      }`}
                    >
                      {PLATFORM_LABELS[p]}
                    </button>
                  )
                })}
              </div>

              {selectedExtraPlatforms.size > 0 && (
                <div className="space-y-2 rounded-lg bg-card-2 p-3">
                  <p className="text-xs font-medium text-muted">Texto que será publicado (reaproveitado da copy gerada):</p>
                  {[...selectedExtraPlatforms].map((p) => {
                    const preview = truncateForPlatform(sourceTextForExtra, p)
                    return (
                      <div key={p}>
                        <div className="mb-0.5 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted">{PLATFORM_LABELS[p]}</span>
                          <span className="text-xs tabular-nums text-muted">
                            {preview.length}/{PLATFORM_CHARACTER_LIMITS[p]}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap rounded border border-line bg-card p-2 text-xs text-ink">
                          {preview}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {extraPublishError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{extraPublishError}</p>
              )}

              <button
                type="button"
                onClick={handlePublishMore}
                disabled={selectedExtraPlatforms.size === 0 || extraPublishing}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
              >
                {extraPublishing ? 'Publicando…' : 'Publicar nas redes selecionadas'}
              </button>
            </div>
          )}
        </div>
      ) : scheduleSuccess ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">
            Post agendado para{' '}
            {scheduleSuccess.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
          </p>
        </div>
      ) : (
        result.status === 'ready' && (
          <div className="space-y-2">
            {publishError && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{publishError}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handlePublish}
                disabled={publishing || scheduling}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
              >
                {publishing ? 'Publicando…' : 'Publicar Agora'}
              </button>
              <button
                onClick={() => setShowScheduler((v) => !v)}
                disabled={publishing || scheduling}
                className="rounded-lg border border-line px-6 py-2.5 text-sm font-semibold text-ink hover:bg-card-2 disabled:opacity-40"
              >
                Agendar
              </button>
            </div>
            {showScheduler && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-card-2 p-4">
                <input
                  type="datetime-local"
                  value={scheduledAtInput}
                  onChange={(e) => setScheduledAtInput(e.target.value)}
                  className="rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
                />
                <button
                  onClick={handleSchedule}
                  disabled={scheduling || !scheduledAtInput}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
                >
                  {scheduling ? 'Agendando…' : 'Confirmar agendamento'}
                </button>
              </div>
            )}
          </div>
        )
      )}

      <button
        onClick={onBack}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card-2"
      >
        Voltar ao Dashboard
      </button>
    </div>
  )
}
