'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api, type PublishResponse } from '../../../lib/api'
import { useWakeLock } from '../../../lib/useWakeLock'
import {
  MAX_GENERATION_ARTIFACTS,
  Platform,
  PLATFORM_CHARACTER_LIMITS,
  PLATFORM_MEDIA_SUPPORT,
  TemplateStyle,
} from '@socialshelf/domain'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
}

const TEMPLATE_STYLE_OPTIONS: Array<{ value: TemplateStyle; label: string }> = [
  { value: TemplateStyle.NO_TEXT, label: 'Sem texto' },
  { value: TemplateStyle.BOLD_BOTTOM, label: 'Faixa inferior' },
  { value: TemplateStyle.CENTERED_OVERLAY, label: 'Overlay escuro' },
  { value: TemplateStyle.TOP_STRIP, label: 'Faixa superior' },
]

const COMING_SOON_PLATFORMS = new Set<Platform>([Platform.TWITTER])

// Plataformas que só podem ser publicadas se houver pelo menos uma imagem anexada
// (ex: Instagram). Antes, o compositor era apenas texto e essas ficavam sempre
// bloqueadas; agora que o usuário pode anexar fotos e montar cards manualmente,
// elas se liberam dinamicamente quando há ao menos uma imagem no post.
const IMAGE_REQUIRED_PLATFORMS = new Set<Platform>(
  Object.values(Platform).filter((p) => PLATFORM_MEDIA_SUPPORT[p].requiresImage),
)

// TikTok não publica texto puro — exige um vídeo enviado pelo próprio usuário
// (_local-adr-policy-036, videoSource: 'user-upload'; geração via IA de slideshow ainda
// não existe). Limites de duração (3–600s) vêm de _local-adr-policy-035.
const VIDEO_REQUIRED_PLATFORMS = new Set<Platform>([Platform.TIKTOK])
const MIN_VIDEO_DURATION_SECONDS = 3
const MAX_VIDEO_DURATION_SECONDS = 600
// Cap conservador para caber no limite de corpo de requisição do Cloud Run somado à
// inflação de ~33% do relay em base64 (apps/api → apps/generator, EDR-035) — vídeos de
// celular em 4K ou HD de alta qualidade passam disso facilmente em poucos segundos.
const MAX_VIDEO_FILE_SIZE_BYTES = 20 * 1024 * 1024
const VIDEO_CONSENT_TEXT =
  'Confirmo que tenho os direitos necessários sobre este vídeo e sobre as pessoas nele, e autorizo seu uso para publicação no TikTok.'

interface ComposeCard {
  id: string
  file: File
  previewUrl: string
  style: TemplateStyle
  headline: string
  body: string
  uploadedPath: string | null
  renderedPath: string | null
  renderedFor: string | null
  rendering: boolean
  error: string | null
}

function cardSnapshot(card: ComposeCard): string {
  return JSON.stringify({ headline: card.headline, body: card.body, style: card.style })
}

function CardPreview({ path }: { path: string }) {
  const { data: url, isLoading, isError } = useQuery({
    queryKey: ['generation-image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-card-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (isError || !url) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-line bg-card-2 text-xs text-muted">
        Não foi possível carregar
      </div>
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Imagem do post" className="aspect-square w-full rounded-lg object-cover" />
}

function CharCounter({ current, max }: { current: number; max: number }) {
  const remaining = max - current
  const pct = current / max
  return (
    <span
      className={`text-xs tabular-nums ${
        pct >= 1 ? 'font-bold text-red-600' : pct >= 0.9 ? 'text-orange-500' : 'text-muted'
      }`}
    >
      {remaining}
    </span>
  )
}

export default function ComposePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repostFromId = searchParams.get('repostFrom')

  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>({})
  const [synced, setSynced] = useState(true)
  const [existingImagePaths, setExistingImagePaths] = useState<string[]>([])
  const [cards, setCards] = useState<ComposeCard[]>([])
  const [prefilled, setPrefilled] = useState(false)

  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null)
  const [videoDurationError, setVideoDurationError] = useState<string | null>(null)
  const [videoConsent, setVideoConsent] = useState(false)

  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduledAtInput, setScheduledAtInput] = useState('')
  const [scheduleSuccess, setScheduleSuccess] = useState<Date | null>(null)
  const [result, setResult] = useState<PublishResponse | null>(null)
  const [error, setError] = useState('')
  // Publicar/agendar inclui o upload do vídeo do TikTok quando presente — pode levar um tempo
  // real em conexões mais fracas, mesmo risco de a tela apagar no meio da espera.
  useWakeLock(publishing || scheduling)

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  const { data: repostSource } = useQuery({
    queryKey: ['post', repostFromId],
    queryFn: () => api.getPost(repostFromId!),
    enabled: !!repostFromId,
  })

  useEffect(() => {
    if (!repostSource || prefilled) return
    setSelectedPlatforms(new Set(repostSource.content.map((c) => c.platform)))
    const newTexts: Partial<Record<Platform, string>> = {}
    repostSource.content.forEach((c) => { newTexts[c.platform] = c.text })
    setTexts(newTexts)
    const firstText = repostSource.content[0]?.text
    setSynced(repostSource.content.every((c) => c.text === firstText))
    setExistingImagePaths(repostSource.imageStoragePaths ?? [])
    setPrefilled(true)
  }, [repostSource, prefilled])

  const validPlatforms = new Set(Object.values(Platform))
  const connectedPlatforms = connections
    ?.map((c) => c.platform as Platform)
    .filter((p) => validPlatforms.has(p)) ?? []

  const hasImages = existingImagePaths.length > 0 || cards.length > 0
  const totalImageCount = existingImagePaths.length + cards.length
  const blockedForNoImage = hasImages ? new Set<Platform>() : IMAGE_REQUIRED_PLATFORMS

  const videoReady =
    videoFile !== null &&
    videoConsent &&
    videoDurationSeconds !== null &&
    videoDurationSeconds >= MIN_VIDEO_DURATION_SECONDS &&
    videoDurationSeconds <= MAX_VIDEO_DURATION_SECONDS
  const blockedForNoVideo = videoReady ? new Set<Platform>() : VIDEO_REQUIRED_PLATFORMS

  const unavailablePlatforms = new Set<Platform>([
    ...COMING_SOON_PLATFORMS,
    ...blockedForNoImage,
    ...blockedForNoVideo,
  ])

  useEffect(() => {
    if (hasImages) return
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      let changed = false
      IMAGE_REQUIRED_PLATFORMS.forEach((p) => { if (next.delete(p)) changed = true })
      return changed ? next : prev
    })
  }, [hasImages])

  useEffect(() => {
    if (videoReady) return
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      let changed = false
      VIDEO_REQUIRED_PLATFORMS.forEach((p) => { if (next.delete(p)) changed = true })
      return changed ? next : prev
    })
  }, [videoReady])

  const handleAddVideo = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return

    // Checado antes de qualquer outra coisa: um arquivo grande demais nem chega a ser
    // anexado — evita que o envio comece e falhe no meio com um erro genérico de rede
    // ("Load failed"/"Failed to fetch") em vez de um aviso claro aqui.
    if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      setVideoDurationError(
        `Vídeo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite atual: ${MAX_VIDEO_FILE_SIZE_BYTES / 1024 / 1024}MB — grave um clipe mais curto ou reduza a qualidade.`,
      )
      return
    }

    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setVideoDurationError(null)
    setVideoDurationSeconds(null)
    setVideoFile(file)
    setVideoConsent(false)
    const url = URL.createObjectURL(file)
    setVideoPreviewUrl(url)

    // Duração é lida no navegador (metadados do próprio arquivo) — evita depender de
    // ffmpeg no servidor só para validar os limites de 3–600s do TikTok.
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      const duration = Math.round(probe.duration)
      setVideoDurationSeconds(duration)
      if (duration < MIN_VIDEO_DURATION_SECONDS || duration > MAX_VIDEO_DURATION_SECONDS) {
        setVideoDurationError(
          `O TikTok exige vídeos entre ${MIN_VIDEO_DURATION_SECONDS} e ${MAX_VIDEO_DURATION_SECONDS} segundos (este tem ${duration}s).`,
        )
      }
    }
    probe.src = url
  }

  const removeVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setVideoFile(null)
    setVideoPreviewUrl(null)
    setVideoDurationSeconds(null)
    setVideoDurationError(null)
    setVideoConsent(false)
  }

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const masterText = texts[Platform.LINKEDIN] ?? texts[Platform.FACEBOOK] ?? texts[Platform.TWITTER] ?? texts[Platform.INSTAGRAM] ?? ''

  const handleTextChange = (platform: Platform, value: string) => {
    if (synced) {
      const newTexts: Partial<Record<Platform, string>> = {}
      selectedPlatforms.forEach((p) => { newTexts[p] = value })
      setTexts(newTexts)
    } else {
      setTexts((prev) => ({ ...prev, [platform]: value }))
    }
  }

  const handleSyncToggle = () => {
    if (!synced) {
      const newTexts: Partial<Record<Platform, string>> = {}
      selectedPlatforms.forEach((p) => { newTexts[p] = masterText })
      setTexts(newTexts)
    }
    setSynced((v) => !v)
  }

  const handleAddImages = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remainingSlots = MAX_GENERATION_ARTIFACTS - existingImagePaths.length - cards.length
    if (remainingSlots <= 0) return
    const newCards: ComposeCard[] = Array.from(files)
      .slice(0, remainingSlots)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        style: TemplateStyle.BOLD_BOTTOM,
        headline: '',
        body: '',
        uploadedPath: null,
        renderedPath: null,
        renderedFor: null,
        rendering: false,
        error: null,
      }))
    setCards((prev) => [...prev, ...newCards])
  }

  const updateCard = (id: string, patch: Partial<ComposeCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const moveCard = (id: string, direction: -1 | 1) => {
    setCards((prev) => {
      const index = prev.findIndex((c) => c.id === id)
      const newIndex = index + direction
      if (index === -1 || newIndex < 0 || newIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(newIndex, 0, moved!)
      return next
    })
  }

  const removeCard = (id: string) => {
    setCards((prev) => {
      const card = prev.find((c) => c.id === id)
      if (card) URL.revokeObjectURL(card.previewUrl)
      return prev.filter((c) => c.id !== id)
    })
  }

  const removeExistingImage = (path: string) => {
    setExistingImagePaths((prev) => prev.filter((p) => p !== path))
  }

  const renderCardPreview = async (id: string) => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    updateCard(id, { rendering: true, error: null })
    try {
      const uploadedPath = card.uploadedPath ?? (await api.uploadImage(card.file))
      const headline = card.style === TemplateStyle.NO_TEXT ? '' : card.headline
      const body = card.style === TemplateStyle.NO_TEXT || !card.body.trim() ? null : card.body
      const renderedPath = await api.renderCard(uploadedPath, headline, body, card.style)
      updateCard(id, {
        uploadedPath,
        renderedPath,
        renderedFor: cardSnapshot(card),
        rendering: false,
      })
    } catch (err) {
      updateCard(id, { rendering: false, error: err instanceof Error ? err.message : 'Erro ao gerar prévia.' })
    }
  }

  const resolveCardImagePath = async (card: ComposeCard): Promise<string> => {
    if (card.renderedPath && card.renderedFor === cardSnapshot(card)) return card.renderedPath
    const uploadedPath = card.uploadedPath ?? (await api.uploadImage(card.file))
    const headline = card.style === TemplateStyle.NO_TEXT ? '' : card.headline
    const body = card.style === TemplateStyle.NO_TEXT || !card.body.trim() ? null : card.body
    return api.renderCard(uploadedPath, headline, body, card.style)
  }

  const validSelectedPlatforms = [...selectedPlatforms].filter((p) => validPlatforms.has(p))

  const canPublish =
    validSelectedPlatforms.length > 0 &&
    validSelectedPlatforms.every((p) => {
      const t = texts[p] ?? ''
      return t.trim().length > 0 && t.length <= PLATFORM_CHARACTER_LIMITS[p]
    }) &&
    !cards.some((c) => c.rendering)

  const buildContent = () => validSelectedPlatforms.map((platform) => ({ platform, text: texts[platform] ?? '' }))

  const buildImagePaths = async () => {
    const cardPaths = await Promise.all(cards.map(resolveCardImagePath))
    return [...existingImagePaths, ...cardPaths]
  }

  // "Load failed" (Safari) / "Failed to fetch" (Chrome) são mensagens genéricas do
  // próprio navegador para falha de rede pura — o mais comum aqui é o vídeo estourando
  // o limite de tamanho durante o envio. Traduzido para algo acionável.
  const describePublishError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err)
    if (/load failed|failed to fetch|networkerror/i.test(raw)) {
      return videoFile
        ? 'Falha de rede ao enviar o vídeo — tente um arquivo menor ou verifique sua conexão.'
        : 'Falha de rede ao publicar — verifique sua conexão e tente novamente.'
    }
    return raw
  }

  const buildVideo = async (): Promise<{ path: string; consentAcceptedAt: string } | null> => {
    if (!validSelectedPlatforms.includes(Platform.TIKTOK) || !videoFile || videoDurationSeconds === null) {
      return null
    }
    return api.uploadVideo(videoFile, videoDurationSeconds, videoConsent)
  }

  const handlePublish = async () => {
    setError('')
    setPublishing(true)
    try {
      const imageStoragePaths = await buildImagePaths()
      const video = await buildVideo()
      const post = await api.createPost(
        buildContent(),
        imageStoragePaths.length > 0 ? imageStoragePaths : undefined,
        undefined,
        undefined,
        video?.path ?? undefined,
        video?.consentAcceptedAt ?? undefined,
      )
      const publishResult = await api.publishPost(post.id)
      setResult(publishResult)
    } catch (err) {
      setError(describePublishError(err))
    } finally {
      setPublishing(false)
    }
  }

  const handleSchedule = async () => {
    if (!scheduledAtInput) return
    const scheduledAt = new Date(scheduledAtInput)
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      setError('Escolha uma data e hora no futuro.')
      return
    }
    setError('')
    setScheduling(true)
    try {
      const imageStoragePaths = await buildImagePaths()
      const video = await buildVideo()
      await api.createPost(
        buildContent(),
        imageStoragePaths.length > 0 ? imageStoragePaths : undefined,
        scheduledAt,
        undefined,
        video?.path ?? undefined,
        video?.consentAcceptedAt ?? undefined,
      )
      setScheduleSuccess(scheduledAt)
      setShowScheduler(false)
    } catch (err) {
      setError(describePublishError(err))
    } finally {
      setScheduling(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">Resultado</h1>
        {result.results.length > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="mb-2 font-semibold text-green-800">Publicado com sucesso:</p>
            <ul className="space-y-1">
              {result.results.map((r) => (
                <li key={r.platform} className="text-sm text-green-700">
                  ✓ {PLATFORM_LABELS[r.platform]} — ID: {r.externalId}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.failedPlatforms.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="mb-2 font-semibold text-red-800">Falhou:</p>
            <ul className="space-y-1">
              {result.failedPlatforms.map((f) => (
                <li key={f.platform} className="text-sm text-red-700">
                  ✗ {PLATFORM_LABELS[f.platform]} — {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  if (scheduleSuccess) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink">Resultado</h1>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">
            Post agendado para{' '}
            {scheduleSuccess.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted hover:text-ink"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">{repostFromId ? 'Repostar' : 'Novo Post'}</h1>
      </div>

      {/* Platform selector */}
      <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-ink">📡 Plataformas</h2>
        {isLoading ? (
          <p className="text-sm text-muted">Carregando conexões…</p>
        ) : connectedPlatforms.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma plataforma conectada.{' '}
            <a href="/dashboard" className="text-accent underline">
              Conectar agora
            </a>
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.filter((p) => !unavailablePlatforms.has(p)).map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  title={`Até ${PLATFORM_CHARACTER_LIMITS[p].toLocaleString('pt-BR')} caracteres`}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    selectedPlatforms.has(p)
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line bg-card text-muted hover:border-accent'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
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
              {connectedPlatforms.filter((p) => blockedForNoImage.has(p)).map((p) => (
                <span
                  key={p}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-line bg-card-2 px-3 py-1 text-sm font-medium text-muted"
                  title="Exige imagem — anexe uma foto abaixo para liberar"
                >
                  {PLATFORM_LABELS[p]}
                  <span className="rounded-full bg-card-2 px-1.5 py-0.5 text-xs font-semibold text-muted">
                    Exige imagem
                  </span>
                </span>
              ))}
              {connectedPlatforms.filter((p) => blockedForNoVideo.has(p)).map((p) => (
                <span
                  key={p}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-line bg-card-2 px-3 py-1 text-sm font-medium text-muted"
                  title="Exige vídeo — anexe um vídeo abaixo e marque o consentimento para liberar"
                >
                  {PLATFORM_LABELS[p]}
                  <span className="rounded-full bg-card-2 px-1.5 py-0.5 text-xs font-semibold text-muted">
                    Exige vídeo
                  </span>
                </span>
              ))}
            </div>
            {connectedPlatforms.some((p) => COMING_SOON_PLATFORMS.has(p)) && (
              <p className="text-xs text-muted">
                * A publicação via X (Twitter) estará disponível em breve. A API do X requer plano pago para envio de posts.
              </p>
            )}
            {connectedPlatforms.some((p) => blockedForNoImage.has(p)) && (
              <p className="text-xs text-muted">
                * Instagram exige uma imagem em todo post — anexe uma foto na seção &quot;Imagens&quot; abaixo para liberar.
              </p>
            )}
            {connectedPlatforms.some((p) => blockedForNoVideo.has(p)) && (
              <p className="text-xs text-muted">
                * TikTok exige um vídeo — anexe na seção &quot;Vídeo&quot; abaixo e marque o consentimento para liberar. Sem música ou narração nesta versão.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Video (TikTok) */}
      <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">🎬 Vídeo (TikTok)</h2>
          {!videoFile && (
            <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-card-2">
              + Anexar vídeo
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => { handleAddVideo(e.target.files); e.target.value = '' }}
                className="hidden"
              />
            </label>
          )}
        </div>

        {!videoFile ? (
          <p className="text-sm text-muted">
            Nenhum vídeo anexado. Necessário para publicar no TikTok — entre {MIN_VIDEO_DURATION_SECONDS} e{' '}
            {MAX_VIDEO_DURATION_SECONDS} segundos, sem música ou narração nesta versão.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4">
              {videoPreviewUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={videoPreviewUrl} controls className="aspect-[9/16] w-32 rounded-lg bg-black" />
              )}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-ink">{videoFile.name}</p>
                <p className="text-xs text-muted">
                  {videoDurationSeconds !== null ? `Duração: ${videoDurationSeconds}s` : 'Lendo duração…'}
                </p>
                {videoDurationError && <p className="text-xs text-red-600">{videoDurationError}</p>}
                <label className="flex cursor-pointer items-start gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={videoConsent}
                    onChange={(e) => setVideoConsent(e.target.checked)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>{VIDEO_CONSENT_TEXT}</span>
                </label>
                <button onClick={removeVideo} className="text-xs text-red-600 hover:underline">
                  Remover vídeo
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Images / manual cards */}
      <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">🖼 Imagens</h2>
          <label
            className={`cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-card-2 ${
              totalImageCount >= MAX_GENERATION_ARTIFACTS ? 'pointer-events-none opacity-40' : ''
            }`}
          >
            + Anexar imagem
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={totalImageCount >= MAX_GENERATION_ARTIFACTS}
              onChange={(e) => { handleAddImages(e.target.files); e.target.value = '' }}
              className="hidden"
            />
          </label>
        </div>

        <p className="mb-3 text-xs text-muted">
          Anexe 1 imagem para um post único, ou 2 ou mais para criar um carrossel no Instagram (na ordem mostrada
          abaixo, até {MAX_GENERATION_ARTIFACTS} imagens).
        </p>

        {totalImageCount > 0 && (
          <p className="mb-3 text-xs font-medium text-accent">
            {totalImageCount === 1 ? 'Post único' : `Carrossel com ${totalImageCount} imagens — nesta ordem`}
          </p>
        )}

        {existingImagePaths.length === 0 && cards.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhuma imagem anexada. Anexe fotos para montar cards manualmente — escolha um modelo e escreva o texto
            que vai aparecer na imagem.
          </p>
        ) : (
          <div className="space-y-4">
            {existingImagePaths.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {existingImagePaths.map((path) => (
                  <div key={path} className="space-y-1">
                    <CardPreview path={path} />
                    <button
                      onClick={() => removeExistingImage(path)}
                      className="w-full text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            {cards.map((card, index) => (
              <div key={card.id} className="rounded-xl border border-line p-4">
                <div className="flex gap-4">
                  <div className="w-28 shrink-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted">
                        #{existingImagePaths.length + index + 1}
                      </span>
                      {cards.length > 1 && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveCard(card.id, -1)}
                            disabled={index === 0}
                            title="Mover para antes"
                            className="rounded border border-line px-1.5 text-xs text-muted hover:bg-card-2 disabled:opacity-30"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => moveCard(card.id, 1)}
                            disabled={index === cards.length - 1}
                            title="Mover para depois"
                            className="rounded border border-line px-1.5 text-xs text-muted hover:bg-card-2 disabled:opacity-30"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.previewUrl} alt="Foto anexada" className="aspect-square w-full rounded-lg object-cover" />
                    {card.renderedPath && card.renderedFor === cardSnapshot(card) && (
                      <CardPreview path={card.renderedPath} />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted">Modelo de card</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TEMPLATE_STYLE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateCard(card.id, { style: opt.value })}
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                              card.style === opt.value
                                ? 'border-accent bg-accent text-accent-ink'
                                : 'border-line bg-card text-muted hover:border-accent'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {card.style !== TemplateStyle.NO_TEXT && (
                      <>
                        <input
                          value={card.headline}
                          onChange={(e) => updateCard(card.id, { headline: e.target.value })}
                          placeholder="Texto principal do card…"
                          className="w-full rounded-lg border border-line p-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <textarea
                          value={card.body}
                          onChange={(e) => updateCard(card.id, { body: e.target.value })}
                          rows={2}
                          placeholder="Texto secundário (opcional)…"
                          className="w-full resize-none rounded-lg border border-line p-2 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </>
                    )}
                    {card.error && <p className="text-xs text-red-600">{card.error}</p>}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => renderCardPreview(card.id)}
                        disabled={card.rendering}
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card-2 disabled:opacity-40"
                      >
                        {card.rendering ? 'Gerando…' : 'Pré-visualizar'}
                      </button>
                      <button
                        onClick={() => removeCard(card.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Text areas */}
      {selectedPlatforms.size > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Conteúdo</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={synced}
                onChange={handleSyncToggle}
                className="accent-accent"
              />
              Mesmo texto para todas
            </label>
          </div>
          {[...selectedPlatforms].map((platform) => {
            const text = texts[platform] ?? ''
            const limit = PLATFORM_CHARACTER_LIMITS[platform]
            return (
              <div
                key={platform}
                className="rounded-2xl border border-line bg-card p-5 shadow-card"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{PLATFORM_LABELS[platform]}</span>
                  <CharCounter current={text.length} max={limit} />
                </div>
                <textarea
                  value={text}
                  onChange={(e) => handleTextChange(platform, e.target.value)}
                  rows={4}
                  placeholder={`Escreva para ${PLATFORM_LABELS[platform]}…`}
                  className="w-full resize-none rounded-lg border border-line p-3 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            )
          })}
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {selectedPlatforms.size > 0 && !canPublish && !publishing && !scheduling && (
        <p className="text-sm text-muted">
          {validSelectedPlatforms.some((p) => (texts[p] ?? '').length > PLATFORM_CHARACTER_LIMITS[p])
            ? 'O texto excede o limite de caracteres de uma das plataformas selecionadas.'
            : cards.some((c) => c.rendering)
              ? 'Aguarde a pré-visualização terminar antes de publicar.'
              : 'Escreva o texto para cada plataforma selecionada antes de publicar.'}
        </p>
      )}

      {selectedPlatforms.size > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePublish}
              disabled={!canPublish || publishing || scheduling}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
            >
              {publishing ? 'Publicando…' : 'Publicar Agora'}
            </button>
            <button
              onClick={() => setShowScheduler((v) => !v)}
              disabled={!canPublish || publishing || scheduling}
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
                className="rounded-lg border border-line bg-card text-ink px-3 py-2 text-sm"
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
      )}
    </div>
  )
}
