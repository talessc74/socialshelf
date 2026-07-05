'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Platform,
  PLATFORM_MEDIA_SUPPORT,
  PLATFORM_CHARACTER_LIMITS,
  TemplateStyle,
  AspectRatio,
  MAX_GENERATION_ARTIFACTS,
} from '@socialshelf/domain'
import { api } from '../../lib/api'
import type { ApiGenerationRequest, ApiTopicSuggestion, PublishResponse } from '../../lib/api'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X',
}

const COMING_SOON_PLATFORMS = new Set<Platform>([Platform.TWITTER])

const ASPECT_RATIO_CLASS: Record<AspectRatio, string> = {
  [AspectRatio.SQUARE]: 'aspect-square',
  [AspectRatio.PORTRAIT]: 'aspect-[3/4]',
  [AspectRatio.LANDSCAPE]: 'aspect-video',
  [AspectRatio.STORY]: 'aspect-[9/16]',
}

function truncateForPlatform(text: string, platform: Platform): string {
  const limit = PLATFORM_CHARACTER_LIMITS[platform]
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1).trimEnd()}…`
}

const DRAFT_KEY = 'socialshelf:criar-atelie-draft'

type IdeiasDraft = {
  description: string
  textContent: string
  selectedPlatforms: Platform[]
  style: TemplateStyle
  aspectRatio: AspectRatio
  topicSuggestionId: string
}

function loadDraft(): IdeiasDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as IdeiasDraft) : null
  } catch {
    return null
  }
}

type Room = 'entrance' | 'ideias' | 'mesa' | 'darkroom' | 'exposicao'
type Path = 'ia' | 'manual' | null

interface CriarContextValue {
  room: Room
  path: Path
  goTo: (room: Room) => void
  choosePath: (path: 'ia' | 'manual') => void

  // dados compartilhados
  connections: Platform[]
  loadingConnections: boolean
  suggestions: ApiTopicSuggestion[]
  brandProfile: { business: { name: string }; voice: { tone: string } } | null

  // Quadro de Ideias
  description: string
  setDescription: (v: string) => void
  textContent: string
  setTextContent: (v: string) => void
  selectedPlatforms: Set<Platform>
  togglePlatform: (p: Platform) => void
  style: TemplateStyle
  setStyle: (v: TemplateStyle) => void
  aspectRatio: AspectRatio
  setAspectRatio: (v: AspectRatio) => void
  topicSuggestionId: string
  setTopicSuggestionId: (v: string) => void
  photoFiles: File[]
  addPhotoFiles: (files: File[]) => void
  removePhotoFile: (i: number) => void
  canGenerate: boolean
  generating: boolean
  generateError: string
  handleGenerate: () => void
  handleClearIdeias: () => void
  generationStage: number
  generationStages: string[]

  // Exposição (resultado de IA)
  result: ApiGenerationRequest | null
  updateResult: (r: ApiGenerationRequest) => void

  // Mesa de Composição (manual)
  mesaSelectedPlatforms: Set<Platform>
  toggleMesaPlatform: (p: Platform) => void
  mesaSync: boolean
  setMesaSync: (v: boolean) => void
  mesaTexts: Partial<Record<Platform, string>>
  setMesaText: (p: Platform, text: string) => void
  mesaImages: File[]
  addMesaImages: (files: File[]) => void
  removeMesaImage: (i: number) => void
  canPublishMesa: boolean
  mesaSubmitting: boolean
  mesaError: string
  handleMesaPublish: (schedule?: Date) => void

  // Exposição — publicar/agendar/retoque
  publishing: boolean
  publishResult: PublishResponse | null
  manualPublishResult: PublishResponse | null
  publishError: string
  handlePublishResult: () => void
  handleScheduleResult: (date: Date) => void
  scheduleSuccess: Date | null
  editingArtifactIndex: number | null
  setEditingArtifactIndex: (i: number | null) => void
  handleEditArtifactText: (position: number, headline: string, body: string | null) => Promise<void>
  handleEditArtifactAi: (position: number, instruction: string) => Promise<void>
  availableExtraPlatforms: Platform[]
  selectedExtraPlatforms: Set<Platform>
  toggleExtraPlatform: (p: Platform) => void
  handlePublishExtra: () => void
  extraPublishing: boolean
}

const CriarContext = createContext<CriarContextValue | null>(null)

export function CriarProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const draft = loadDraft()

  const [room, setRoom] = useState<Room>('entrance')
  const [path, setPath] = useState<Path>(null)

  const { data: connectionsData, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })
  const { data: suggestionsData } = useQuery({ queryKey: ['topic-suggestions'], queryFn: () => api.getTopicSuggestions() })
  const { data: brandProfile } = useQuery({ queryKey: ['brand-profile'], queryFn: () => api.getBrandProfile() })

  const connections = (connectionsData ?? []).map((c) => c.platform).filter((p) => Object.values(Platform).includes(p))
  const suggestions = suggestionsData ?? []

  // ---- Quadro de Ideias ----
  const [description, setDescription] = useState(() => draft?.description ?? '')
  const [textContent, setTextContent] = useState(() => draft?.textContent ?? '')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(() => new Set(draft?.selectedPlatforms ?? []))
  const [style, setStyle] = useState<TemplateStyle>(() => draft?.style ?? TemplateStyle.NO_TEXT)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => draft?.aspectRatio ?? AspectRatio.SQUARE)
  const [topicSuggestionId, setTopicSuggestionId] = useState(() => draft?.topicSuggestionId ?? '')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [result, setResult] = useState<ApiGenerationRequest | null>(null)
  const [generationStage, setGenerationStage] = useState(0)

  useEffect(() => {
    const data: IdeiasDraft = { description, textContent, selectedPlatforms: [...selectedPlatforms], style, aspectRatio, topicSuggestionId }
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  }, [description, textContent, selectedPlatforms, style, aspectRatio, topicSuggestionId])

  useEffect(() => {
    if (room !== 'darkroom') {
      setGenerationStage(0)
      return
    }
    const interval = setInterval(() => setGenerationStage((s) => Math.min(s + 1, 2)), 4000)
    return () => clearInterval(interval)
  }, [room])

  const generationStages = [
    'Lendo a voz da marca…',
    'Escrevendo a copy e decidindo a estrutura do post…',
    photoFiles.length > 0 ? `Criando ${photoFiles.length} card(s)…` : 'Criando as imagens dos cards…',
  ]

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const addPhotoFiles = (files: File[]) => setPhotoFiles((prev) => [...prev, ...files].slice(0, MAX_GENERATION_ARTIFACTS))
  const removePhotoFile = (i: number) => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))

  const canGenerate = description.trim().length > 0 && selectedPlatforms.size > 0 && !generating

  const handleClearIdeias = () => {
    setDescription('')
    setTextContent('')
    setSelectedPlatforms(new Set())
    setStyle(TemplateStyle.NO_TEXT)
    setAspectRatio(AspectRatio.SQUARE)
    setTopicSuggestionId('')
    setPhotoFiles([])
    setGenerateError('')
    window.sessionStorage.removeItem(DRAFT_KEY)
  }

  const handleGenerate = async () => {
    setGenerateError('')
    setGenerating(true)
    setPath('ia')
    setRoom('darkroom')
    try {
      const imageStoragePaths = photoFiles.length > 0 ? await Promise.all(photoFiles.map((f) => api.uploadImage(f))) : undefined
      const generationRequest = await api.generateContent({
        description: description.trim(),
        ...(textContent.trim() && { textContent: textContent.trim() }),
        targetPlatforms: [...selectedPlatforms],
        style,
        aspectRatio,
        ...(topicSuggestionId && { topicSuggestionId }),
        ...(imageStoragePaths && { imageStoragePaths }),
      })
      setResult(generationRequest)
      window.sessionStorage.removeItem(DRAFT_KEY)
      setRoom('exposicao')
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Erro ao gerar conteúdo.')
      setRoom('ideias')
    } finally {
      setGenerating(false)
    }
  }

  // ---- Mesa de Composição ----
  const [mesaSelectedPlatforms, setMesaSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [mesaSync, setMesaSync] = useState(false)
  const [mesaTexts, setMesaTexts] = useState<Partial<Record<Platform, string>>>({})
  const [mesaImages, setMesaImages] = useState<File[]>([])
  const [mesaSubmitting, setMesaSubmitting] = useState(false)
  const [mesaError, setMesaError] = useState('')
  const [manualPublishResult, setManualPublishResult] = useState<PublishResponse | null>(null)

  const toggleMesaPlatform = (p: Platform) => {
    setMesaSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else {
        if (PLATFORM_MEDIA_SUPPORT[p].requiresImage && mesaImages.length === 0) return prev
        next.add(p)
      }
      return next
    })
  }

  const setMesaText = (p: Platform, text: string) => {
    setMesaTexts((prev) => {
      if (mesaSync) {
        const next: Partial<Record<Platform, string>> = {}
        for (const platform of mesaSelectedPlatforms) next[platform] = text
        return next
      }
      return { ...prev, [p]: text }
    })
  }

  const addMesaImages = (files: File[]) => setMesaImages((prev) => [...prev, ...files].slice(0, MAX_GENERATION_ARTIFACTS))
  const removeMesaImage = (i: number) =>
    setMesaImages((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      if (next.length === 0) {
        setMesaSelectedPlatforms((sel) => new Set([...sel].filter((p) => !PLATFORM_MEDIA_SUPPORT[p].requiresImage)))
      }
      return next
    })

  const canPublishMesa =
    mesaSelectedPlatforms.size > 0 &&
    [...mesaSelectedPlatforms].every((p) => {
      const t = mesaTexts[p] ?? ''
      return t.trim().length > 0 && t.length <= PLATFORM_CHARACTER_LIMITS[p]
    })

  const handleMesaPublish = async (schedule?: Date) => {
    if (!canPublishMesa) return
    setMesaError('')
    setMesaSubmitting(true)
    setPath('manual')
    try {
      const imageStoragePaths = mesaImages.length > 0 ? await Promise.all(mesaImages.map((f) => api.uploadImage(f))) : undefined
      const content = [...mesaSelectedPlatforms].map((platform) => ({ platform, text: mesaTexts[platform] ?? '' }))
      const post = await api.createPost(content, imageStoragePaths, schedule)
      if (!schedule) {
        const response = await api.publishPost(post.id)
        setManualPublishResult(response)
      } else {
        setManualPublishResult({ postId: post.id, results: [], failedPlatforms: [] })
      }
      setRoom('exposicao')
    } catch (err) {
      setMesaError(err instanceof Error ? err.message : 'Erro ao publicar.')
    } finally {
      setMesaSubmitting(false)
    }
  }

  // ---- Exposição ----
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<PublishResponse | null>(null)
  const [publishError, setPublishError] = useState('')
  const [scheduleSuccess, setScheduleSuccess] = useState<Date | null>(null)
  const [editingArtifactIndex, setEditingArtifactIndex] = useState<number | null>(null)
  const [selectedExtraPlatforms, setSelectedExtraPlatforms] = useState<Set<Platform>>(new Set())
  const [extraPublishing, setExtraPublishing] = useState(false)
  const [extraUsedPlatforms, setExtraUsedPlatforms] = useState<Set<Platform>>(new Set())

  const readyArtifacts = result?.outputs?.artifacts.filter((a) => a.status === 'ready') ?? []

  const buildContentFromResult = () => {
    if (!result?.outputs) return []
    return Object.entries(result.outputs.copies).map(([platform, copy]) => ({ platform: platform as Platform, text: copy!.text }))
  }

  const handlePublishResult = async () => {
    if (!result?.outputs) return
    setPublishError('')
    setPublishing(true)
    try {
      const post = await api.createPost(buildContentFromResult(), readyArtifacts.map((a) => a.imageStoragePath!))
      const response = await api.publishPost(post.id)
      setPublishResult(response)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Erro ao publicar.')
    } finally {
      setPublishing(false)
    }
  }

  const handleScheduleResult = async (date: Date) => {
    if (!result?.outputs) return
    setPublishError('')
    setPublishing(true)
    try {
      await api.createPost(buildContentFromResult(), readyArtifacts.map((a) => a.imageStoragePath!), date)
      setScheduleSuccess(date)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Erro ao agendar.')
    } finally {
      setPublishing(false)
    }
  }

  const handleEditArtifactText = async (position: number, headline: string, body: string | null) => {
    if (!result) return
    const updated = await api.editArtifactText(result.id, position, headline, body)
    setResult(updated)
  }

  const handleEditArtifactAi = async (position: number, instruction: string) => {
    if (!result) return
    const updated = await api.editArtifact(result.id, position, instruction)
    setResult(updated)
  }

  const usedPlatforms = new Set<Platform>([...Object.keys(result?.outputs?.copies ?? {}).map((p) => p as Platform), ...extraUsedPlatforms])
  const availableExtraPlatforms = connections.filter((p) => !usedPlatforms.has(p) && !COMING_SOON_PLATFORMS.has(p))

  const toggleExtraPlatform = (p: Platform) => {
    setSelectedExtraPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const handlePublishExtra = async () => {
    if (selectedExtraPlatforms.size === 0 || !result?.outputs) return
    setExtraPublishing(true)
    try {
      const texts = Object.values(result.outputs.copies).map((c) => c!.text)
      const longest = texts.reduce((a, b) => (b.length > a.length ? b : a), texts[0] ?? '')
      const content = [...selectedExtraPlatforms].map((platform) => ({ platform, text: truncateForPlatform(longest, platform) }))
      const post = await api.createPost(content, readyArtifacts.map((a) => a.imageStoragePath!))
      const response = await api.publishPost(post.id)
      setPublishResult((prev) => ({
        postId: prev?.postId ?? response.postId,
        results: [...(prev?.results ?? []), ...response.results],
        failedPlatforms: [...(prev?.failedPlatforms ?? []), ...response.failedPlatforms],
      }))
      setExtraUsedPlatforms((prev) => new Set([...prev, ...selectedExtraPlatforms]))
      setSelectedExtraPlatforms(new Set())
    } finally {
      setExtraPublishing(false)
    }
  }

  const goTo = (next: Room) => setRoom(next)
  const choosePath = (p: 'ia' | 'manual') => {
    setPath(p)
    goTo(p === 'ia' ? 'ideias' : 'mesa')
  }

  const updateResult = (r: ApiGenerationRequest) => {
    setResult(r)
    queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
  }

  const value: CriarContextValue = {
    room,
    path,
    goTo,
    choosePath,
    connections,
    loadingConnections,
    suggestions,
    brandProfile: brandProfile ?? null,
    description,
    setDescription,
    textContent,
    setTextContent,
    selectedPlatforms,
    togglePlatform,
    style,
    setStyle,
    aspectRatio,
    setAspectRatio,
    topicSuggestionId,
    setTopicSuggestionId,
    photoFiles,
    addPhotoFiles,
    removePhotoFile,
    canGenerate,
    generating,
    generateError,
    handleGenerate,
    handleClearIdeias,
    generationStage,
    generationStages,
    result,
    updateResult,
    mesaSelectedPlatforms,
    toggleMesaPlatform,
    mesaSync,
    setMesaSync,
    mesaTexts,
    setMesaText,
    mesaImages,
    addMesaImages,
    removeMesaImage,
    canPublishMesa,
    mesaSubmitting,
    mesaError,
    handleMesaPublish,
    publishing,
    publishResult,
    manualPublishResult,
    publishError,
    handlePublishResult,
    handleScheduleResult,
    scheduleSuccess,
    editingArtifactIndex,
    setEditingArtifactIndex,
    handleEditArtifactText,
    handleEditArtifactAi,
    availableExtraPlatforms,
    selectedExtraPlatforms,
    toggleExtraPlatform,
    handlePublishExtra,
    extraPublishing,
  }

  return <CriarContext.Provider value={value}>{children}</CriarContext.Provider>
}

function useCriar(): CriarContextValue {
  const ctx = useContext(CriarContext)
  if (!ctx) throw new Error('useCriar deve ser usado dentro de CriarProvider')
  return ctx
}

const INK = 'rgba(36,29,16,0.85)'
const INK_DIM = 'rgba(36,29,16,0.5)'
const CORK = 'linear-gradient(160deg, #c9a876 0%, #a9855a 100%)'
const WALNUT = '#2e2016'
const TERRACOTTA = '#b8543a'
const SAFELIGHT_BG = 'radial-gradient(ellipse at 50% 20%, #7a1018 0%, #1a0708 55%, #0d0304 100%)'
const GALLERY_BG = 'linear-gradient(180deg, #ece3d0 0%, #dcd0b4 100%)'
const PRINT = '#f6efe0'

function PlatformChip({
  platform,
  selected,
  onClick,
  disabled,
}: {
  platform: Platform
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const isComingSoon = COMING_SOON_PLATFORMS.has(platform)
  return (
    <button
      onClick={onClick}
      disabled={disabled || isComingSoon}
      title={isComingSoon ? 'Em breve' : PLATFORM_MEDIA_SUPPORT[platform].requiresImage ? 'Exige imagem' : undefined}
      className="rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40"
      style={{
        background: selected ? TERRACOTTA : 'rgba(255,255,255,0.5)',
        color: selected ? '#fff8ef' : INK,
        border: `1px solid ${selected ? TERRACOTTA : 'rgba(36,29,16,0.2)'}`,
      }}
    >
      {PLATFORM_LABELS[platform]}
      {isComingSoon && ' (em breve)'}
    </button>
  )
}

function EntranceRoom() {
  const { choosePath } = useCriar()
  return (
    <div
      className="flex h-full items-center justify-center gap-4 p-6"
      style={{ background: `linear-gradient(160deg, ${WALNUT} 0%, #1a1108 100%)` }}
    >
      <button
        onClick={() => choosePath('ia')}
        className="flex-1 max-w-[220px] rounded p-4 text-center transition-transform hover:-translate-y-1"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="mb-3 aspect-[4/3] w-full rounded" style={{ background: CORK, boxShadow: '0 10px 24px rgba(0,0,0,0.4)' }} />
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: PRINT, fontSize: '15px' }}>Quadro de Ideias</p>
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: TERRACOTTA }}>gerar com IA</p>
      </button>
      <button
        onClick={() => choosePath('manual')}
        className="flex-1 max-w-[220px] rounded p-4 text-center transition-transform hover:-translate-y-1"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="mb-3 aspect-[4/3] w-full rounded" style={{ background: `linear-gradient(160deg, #4a3626, ${WALNUT})`, boxShadow: '0 10px 24px rgba(0,0,0,0.4)' }} />
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: PRINT, fontSize: '15px' }}>Mesa de Composição</p>
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: TERRACOTTA }}>escrever à mão</p>
      </button>
    </div>
  )
}

function IdeiasRoom() {
  const {
    goTo,
    connections,
    loadingConnections,
    suggestions,
    description,
    setDescription,
    textContent,
    setTextContent,
    selectedPlatforms,
    togglePlatform,
    topicSuggestionId,
    setTopicSuggestionId,
    photoFiles,
    addPhotoFiles,
    removePhotoFile,
    canGenerate,
    generateError,
    handleGenerate,
    handleClearIdeias,
  } = useCriar()

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: CORK }}>
      <button onClick={() => goTo('entrance')} className="mb-3 rounded-full px-2.5 py-1 text-[10px]" style={{ background: 'rgba(0,0,0,0.15)', color: '#fff' }}>
        ← voltar ao ateliê
      </button>

      <div className="mb-3 rounded bg-[#fdfaf3] p-3" style={{ boxShadow: '3px 6px 14px rgba(0,0,0,0.3)' }}>
        <p className="mb-1 text-[9px] uppercase tracking-wide" style={{ color: INK_DIM }}>
          O que você quer publicar
        </p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Ex: lançamento do EP novo, bastidores do ensaio…"
          className="w-full resize-none border-none bg-transparent text-sm outline-none"
          style={{ color: INK, fontFamily: 'Georgia, serif' }}
        />
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          rows={1}
          placeholder="Texto-base opcional…"
          className="mt-1 w-full resize-none border-none bg-transparent text-xs outline-none"
          style={{ color: INK_DIM }}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mb-3 rounded bg-[#fdfaf3] p-3" style={{ boxShadow: '3px 6px 14px rgba(0,0,0,0.3)' }}>
          <p className="mb-1 text-[9px] uppercase tracking-wide" style={{ color: INK_DIM }}>
            Pauta sugerida (opcional)
          </p>
          <select
            value={topicSuggestionId}
            onChange={(e) => setTopicSuggestionId(e.target.value)}
            className="w-full rounded border-none bg-black/5 p-1.5 text-xs"
            style={{ color: INK }}
          >
            <option value="">Nenhuma — usar só a descrição</option>
            {suggestions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.headline}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3 rounded bg-[#fdfaf3] p-3" style={{ boxShadow: '3px 6px 14px rgba(0,0,0,0.3)' }}>
        <p className="mb-1.5 text-[9px] uppercase tracking-wide" style={{ color: INK_DIM }}>
          Onde publicar
        </p>
        {loadingConnections ? (
          <p className="text-xs" style={{ color: INK_DIM }}>Carregando…</p>
        ) : connections.length === 0 ? (
          <p className="text-xs" style={{ color: INK_DIM }}>Nenhuma rede conectada.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {connections.map((p) => (
              <PlatformChip key={p} platform={p} selected={selectedPlatforms.has(p)} onClick={() => togglePlatform(p)} />
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 rounded bg-[#fdfaf3] p-3" style={{ boxShadow: '3px 6px 14px rgba(0,0,0,0.3)' }}>
        <p className="mb-1.5 text-[9px] uppercase tracking-wide" style={{ color: INK_DIM }}>
          Fotos de referência (opcional — define a quantidade de cards)
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={photoFiles.length >= MAX_GENERATION_ARTIFACTS}
          onChange={(e) => {
            addPhotoFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
          className="block w-full text-xs"
        />
        {photoFiles.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {photoFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded bg-black/5 px-2 py-1 text-[10px]" style={{ color: INK }}>
                <span className="truncate">#{i + 1} {f.name}</span>
                <button onClick={() => removePhotoFile(i)} className="text-red-700">remover</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {generateError && (
        <p className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{generateError}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="rounded-full px-6 py-2.5 text-xs font-bold disabled:opacity-40"
          style={{ background: TERRACOTTA, color: '#fff8ef' }}
        >
          Revelar ideia
        </button>
        <button onClick={handleClearIdeias} className="rounded-full px-4 py-2.5 text-xs font-semibold" style={{ color: INK_DIM }}>
          Limpar
        </button>
      </div>
    </div>
  )
}

function DarkroomRoom() {
  const { generationStages, generationStage } = useCriar()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: SAFELIGHT_BG }}>
      <div
        className="h-16 w-16 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(200,31,44,0.5), transparent 70%)', filter: 'blur(2px)' }}
      />
      <div className="w-full max-w-xs space-y-2">
        {generationStages.map((stage, i) => (
          <p key={stage} style={{ fontSize: '12px', color: i <= generationStage ? PRINT : 'rgba(246,239,224,0.35)' }}>
            {i === generationStage ? '● ' : i < generationStage ? '✓ ' : '○ '}
            {stage}
          </p>
        ))}
      </div>
      <p style={{ fontStyle: 'italic', fontSize: '12px', color: 'rgba(246,239,224,0.6)' }}>
        revelando na câmara escura — pode levar até 2 minutos…
      </p>
    </div>
  )
}

function ArtifactEditor({ position, onClose }: { position: number; onClose: () => void }) {
  const { result, handleEditArtifactText, handleEditArtifactAi } = useCriar()
  const [mode, setMode] = useState<'menu' | 'text' | 'ai'>('menu')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [instruction, setInstruction] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const artifact = result?.outputs?.artifacts.find((a) => a.position === position)
  const canEditText = artifact?.backgroundImageStoragePath !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Retocar card #{position}</p>
          <button onClick={onClose} className="text-xs text-muted">fechar ✕</button>
        </div>
        {mode === 'menu' && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode('text')}
              disabled={!canEditText}
              className="flex-1 rounded bg-black/5 px-3 py-2 text-xs font-medium disabled:opacity-30"
            >
              ✏️ Editar texto
            </button>
            <button onClick={() => setMode('ai')} className="flex-1 rounded bg-black/5 px-3 py-2 text-xs font-medium">
              🖌️ Editar com IA
            </button>
          </div>
        )}
        {mode === 'text' && (
          <div className="space-y-2">
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Título" className="w-full rounded border p-2 text-sm" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Texto de apoio (opcional)" className="w-full rounded border p-2 text-sm" />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setMode('menu')} className="rounded border px-3 py-1.5 text-xs">Cancelar</button>
              <button
                disabled={submitting || !headline.trim()}
                onClick={async () => {
                  setSubmitting(true)
                  setError('')
                  try {
                    await handleEditArtifactText(position, headline.trim(), body.trim() || null)
                    setMode('menu')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erro ao editar.')
                  } finally {
                    setSubmitting(false)
                  }
                }}
                className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-40"
              >
                {submitting ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        )}
        {mode === 'ai' && (
          <div className="space-y-2">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="Ex: deixe o fundo mais claro…"
              className="w-full rounded border p-2 text-sm"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setMode('menu')} className="rounded border px-3 py-1.5 text-xs">Cancelar</button>
              <button
                disabled={submitting || !instruction.trim()}
                onClick={async () => {
                  setSubmitting(true)
                  setError('')
                  try {
                    await handleEditArtifactAi(position, instruction.trim())
                    setMode('menu')
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erro ao editar.')
                  } finally {
                    setSubmitting(false)
                  }
                }}
                className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-40"
              >
                {submitting ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExposicaoRoom({ onClose }: { onClose: () => void }) {
  const {
    path,
    result,
    goTo,
    publishing,
    publishResult,
    manualPublishResult,
    publishError,
    handlePublishResult,
    handleScheduleResult,
    scheduleSuccess,
    editingArtifactIndex,
    setEditingArtifactIndex,
    availableExtraPlatforms,
    selectedExtraPlatforms,
    toggleExtraPlatform,
    handlePublishExtra,
    extraPublishing,
  } = useCriar()
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleInput, setScheduleInput] = useState('')

  const isIa = path === 'ia'
  const artifacts = result?.outputs?.artifacts ?? []
  const readyArtifacts = artifacts.filter((a) => a.status === 'ready')
  const aspectClass = result ? ASPECT_RATIO_CLASS[result.inputs.aspectRatio] : 'aspect-square'
  const mainArtifact = readyArtifacts[0]
  const headline = result?.outputs?.headlines?.[0] ?? 'Pronto para expor'

  const donePublishing = isIa ? !!publishResult || !!scheduleSuccess : !!manualPublishResult

  return (
    <div className="h-full overflow-y-auto p-6" style={{ background: GALLERY_BG }}>
      <div className="mb-4 flex items-center justify-between">
        <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: INK }}>Exposição</p>
        <button onClick={() => { goTo('entrance') }} className="rounded-full bg-black/10 px-2.5 py-1 text-[10px]" style={{ color: INK }}>
          reiniciar ↺
        </button>
      </div>

      {isIa && result?.status === 'failed' && (
        <p className="mb-3 rounded bg-red-100 px-3 py-2 text-xs text-red-800">Falha na geração: {result.error}</p>
      )}

      {isIa ? (
        <>
          {mainArtifact?.imageStoragePath ? (
            <ArtifactImage path={mainArtifact.imageStoragePath} aspectClass={aspectClass} />
          ) : (
            <div className={`w-full max-w-xs mx-auto rounded bg-black/10 flex items-center justify-center ${aspectClass}`}>
              <p className="text-xs" style={{ color: INK_DIM }}>sem imagem</p>
            </div>
          )}

          {artifacts.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {artifacts.map((a) => (
                <button
                  key={a.position}
                  onClick={() => a.status === 'ready' && setEditingArtifactIndex(a.position)}
                  className="h-14 w-11 shrink-0 rounded border-2"
                  style={{ borderColor: a.position === mainArtifact?.position ? TERRACOTTA : 'rgba(0,0,0,0.15)' }}
                >
                  {a.imageStoragePath ? (
                    <ArtifactImage path={a.imageStoragePath} aspectClass="aspect-[4/5]" small />
                  ) : (
                    <span className="text-[8px]" style={{ color: INK_DIM }}>{a.status}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex justify-center gap-2">
            {readyArtifacts.map((a) => (
              <button
                key={a.position}
                onClick={() => setEditingArtifactIndex(a.position)}
                className="rounded-full bg-white/60 px-3 py-1 text-[10px] font-medium"
                style={{ color: INK }}
              >
                retocar #{a.position}
              </button>
            ))}
          </div>

          {result?.outputs && Object.keys(result.outputs.copies).length > 0 && (
            <div className="mx-auto mt-4 max-w-md space-y-2">
              {Object.entries(result.outputs.copies).map(([platform, copy]) => (
                <div key={platform} className="rounded bg-white/60 p-2">
                  <p className="text-[9px] font-bold uppercase" style={{ color: TERRACOTTA }}>{PLATFORM_LABELS[platform as Platform]}</p>
                  <p className="text-xs" style={{ color: INK }}>{copy?.text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mx-auto max-w-md rounded bg-white/60 p-3">
          <p className="mb-1 text-[9px] font-bold uppercase" style={{ color: TERRACOTTA }}>{headline}</p>
          <p className="text-xs" style={{ color: INK_DIM }}>Post manual pronto — composto na Mesa de Composição.</p>
        </div>
      )}

      {editingArtifactIndex !== null && <ArtifactEditor position={editingArtifactIndex} onClose={() => setEditingArtifactIndex(null)} />}

      <div className="mx-auto mt-5 max-w-md">
        {donePublishing ? (
          <div className="space-y-2">
            {isIa && publishResult && (
              <>
                {publishResult.results.length > 0 && (
                  <div className="rounded bg-green-100 p-3">
                    <p className="mb-1 text-xs font-semibold text-green-800">Publicado:</p>
                    {publishResult.results.map((r) => (
                      <p key={r.platform} className="text-xs text-green-700">✓ {PLATFORM_LABELS[r.platform]}</p>
                    ))}
                  </div>
                )}
                {publishResult.failedPlatforms.length > 0 && (
                  <div className="rounded bg-red-100 p-3">
                    {publishResult.failedPlatforms.map((f) => (
                      <p key={f.platform} className="text-xs text-red-700">✗ {PLATFORM_LABELS[f.platform]} — {f.reason}</p>
                    ))}
                  </div>
                )}
                {availableExtraPlatforms.length > 0 && (
                  <div className="rounded bg-white/60 p-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase" style={{ color: TERRACOTTA }}>Expor também em</p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {availableExtraPlatforms.map((p) => (
                        <PlatformChip key={p} platform={p} selected={selectedExtraPlatforms.has(p)} onClick={() => toggleExtraPlatform(p)} />
                      ))}
                    </div>
                    <button
                      onClick={handlePublishExtra}
                      disabled={selectedExtraPlatforms.size === 0 || extraPublishing}
                      className="rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-40"
                      style={{ background: TERRACOTTA, color: '#fff8ef' }}
                    >
                      {extraPublishing ? 'Publicando…' : 'Publicar nas redes selecionadas'}
                    </button>
                  </div>
                )}
              </>
            )}
            {isIa && scheduleSuccess && (
              <p className="rounded bg-green-100 p-3 text-xs text-green-800">
                Agendado para {scheduleSuccess.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
              </p>
            )}
            {!isIa && manualPublishResult && (
              <div className="rounded bg-green-100 p-3">
                {manualPublishResult.results.length > 0 ? (
                  manualPublishResult.results.map((r) => <p key={r.platform} className="text-xs text-green-700">✓ {PLATFORM_LABELS[r.platform]}</p>)
                ) : (
                  <p className="text-xs text-green-800">Agendado com sucesso.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          isIa && (
            <div className="space-y-2">
              {publishError && <p className="rounded bg-red-100 px-3 py-2 text-xs text-red-800">{publishError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handlePublishResult}
                  disabled={publishing}
                  className="rounded-full px-5 py-2 text-xs font-bold disabled:opacity-40"
                  style={{ background: TERRACOTTA, color: '#fff8ef' }}
                >
                  {publishing ? 'Publicando…' : 'Publicar agora'}
                </button>
                <button
                  onClick={() => setShowScheduler((v) => !v)}
                  className="rounded-full border px-5 py-2 text-xs font-bold"
                  style={{ borderColor: 'rgba(36,29,16,0.3)', color: INK }}
                >
                  Agendar exposição
                </button>
              </div>
              {showScheduler && (
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduleInput}
                    onChange={(e) => setScheduleInput(e.target.value)}
                    className="rounded border px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => scheduleInput && handleScheduleResult(new Date(scheduleInput))}
                    disabled={!scheduleInput || publishing}
                    className="rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                    style={{ background: TERRACOTTA, color: '#fff8ef' }}
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>
          )
        )}

        <button onClick={onClose} className="mt-4 text-xs font-semibold" style={{ color: INK_DIM }}>
          ← Fechar o livro
        </button>
      </div>
    </div>
  )
}

function ArtifactImage({ path, aspectClass, small }: { path: string; aspectClass: string; small?: boolean }) {
  const { data: url, isLoading } = useQuery({ queryKey: ['generation-image-url', path], queryFn: () => api.getImageUrl(path) })
  if (isLoading || !url) {
    return <div className={`w-full animate-pulse rounded bg-black/10 ${aspectClass}`} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${small ? 'h-full w-full' : 'mx-auto max-w-xs w-full'} rounded object-cover ${aspectClass}`} />
}

function MesaRoom() {
  const {
    goTo,
    connections,
    mesaSelectedPlatforms,
    toggleMesaPlatform,
    mesaSync,
    setMesaSync,
    mesaTexts,
    setMesaText,
    mesaImages,
    addMesaImages,
    removeMesaImage,
    canPublishMesa,
    mesaSubmitting,
    mesaError,
    handleMesaPublish,
  } = useCriar()
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleInput, setScheduleInput] = useState('')

  return (
    <div className="h-full overflow-y-auto p-5" style={{ background: `linear-gradient(180deg, #4a3626 0%, ${WALNUT} 100%)` }}>
      <button onClick={() => goTo('entrance')} className="mb-3 rounded-full px-2.5 py-1 text-[10px]" style={{ background: 'rgba(255,255,255,0.1)', color: PRINT }}>
        ← voltar ao ateliê
      </button>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {connections.map((p) => (
          <PlatformChip
            key={p}
            platform={p}
            selected={mesaSelectedPlatforms.has(p)}
            onClick={() => toggleMesaPlatform(p)}
            disabled={PLATFORM_MEDIA_SUPPORT[p].requiresImage && mesaImages.length === 0}
          />
        ))}
      </div>
      {[...connections].some((p) => PLATFORM_MEDIA_SUPPORT[p].requiresImage && mesaImages.length === 0 && !mesaSelectedPlatforms.has(p)) && (
        <p className="mb-3 text-[10px]" style={{ color: 'rgba(246,239,224,0.5)' }}>
          Redes marcadas com foto obrigatória só ficam disponíveis depois de anexar uma imagem.
        </p>
      )}

      <label className="mb-3 flex items-center gap-2 text-xs" style={{ color: PRINT }}>
        <input type="checkbox" checked={mesaSync} onChange={(e) => setMesaSync(e.target.checked)} />
        mesmo texto para todas
      </label>

      <div className="space-y-2">
        {[...mesaSelectedPlatforms].map((p) => {
          const text = mesaTexts[p] ?? ''
          const limit = PLATFORM_CHARACTER_LIMITS[p]
          return (
            <div key={p} className="rounded bg-[#fdfaf3] p-2.5" style={{ fontFamily: 'Courier New, monospace' }}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-bold" style={{ color: INK }}>{PLATFORM_LABELS[p]}</p>
                <p className="text-[9px]" style={{ color: text.length > limit ? '#c81f2c' : INK_DIM }}>
                  {text.length}/{limit}
                </p>
              </div>
              <textarea
                value={text}
                onChange={(e) => setMesaText(p, e.target.value)}
                rows={3}
                className="w-full resize-none border-none bg-transparent text-xs outline-none"
                style={{ color: INK }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 rounded bg-[#fdfaf3] p-2.5">
        <p className="mb-1.5 text-[9px] uppercase" style={{ color: INK_DIM }}>Fotos</p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            addMesaImages(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
          className="block w-full text-xs"
        />
        {mesaImages.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {mesaImages.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded bg-black/5 px-2 py-1 text-[10px]">
                #{i + 1} <button onClick={() => removeMesaImage(i)} className="text-red-700">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mesaError && <p className="mt-2 rounded bg-red-100 px-3 py-2 text-xs text-red-800">{mesaError}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => handleMesaPublish()}
          disabled={!canPublishMesa || mesaSubmitting}
          className="rounded-full px-5 py-2 text-xs font-bold disabled:opacity-40"
          style={{ background: TERRACOTTA, color: '#fff8ef' }}
        >
          {mesaSubmitting ? 'Publicando…' : 'Publicar agora'}
        </button>
        <button
          onClick={() => setShowScheduler((v) => !v)}
          className="rounded-full border px-5 py-2 text-xs font-bold"
          style={{ borderColor: 'rgba(246,239,224,0.4)', color: PRINT }}
        >
          Agendar
        </button>
      </div>
      {showScheduler && (
        <div className="mt-2 flex items-center gap-2">
          <input type="datetime-local" value={scheduleInput} onChange={(e) => setScheduleInput(e.target.value)} className="rounded border px-2 py-1.5 text-xs" />
          <button
            onClick={() => scheduleInput && handleMesaPublish(new Date(scheduleInput))}
            disabled={!scheduleInput || !canPublishMesa || mesaSubmitting}
            className="rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            style={{ background: TERRACOTTA, color: '#fff8ef' }}
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  )
}

export function CriarRoom({ onClose }: { onClose: () => void; isMobile: boolean }) {
  const { room } = useCriar()

  return (
    <div className="h-full w-full">
      {room === 'entrance' && <EntranceRoom />}
      {room === 'ideias' && <IdeiasRoom />}
      {room === 'mesa' && <MesaRoom />}
      {room === 'darkroom' && <DarkroomRoom />}
      {room === 'exposicao' && <ExposicaoRoom onClose={onClose} />}
    </div>
  )
}
