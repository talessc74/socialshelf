'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform, PLATFORM_CHARACTER_LIMITS, isAspectRatioUnsupportedForInstagram } from '@socialshelf/domain'
import type { ApiPost, PostContent } from '../../../lib/api'
import { PostDetailModal } from '../../../components/PostDetailModal'
import { buildScheduleSummary } from '../../../lib/selfieScheduleSummary'
import { useSelfieNarrateOnReady } from '../../../contexts/AssistantContext'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function PostThumbnail({
  path,
  flagUnsupportedForInstagram = false,
}: {
  path: string
  // Só faz sentido quando o post tem Instagram entre as redes-alvo (ver PostCard) — carrega a
  // imagem real no navegador e lê as dimensões (naturalWidth/naturalHeight), sem chamada nova ao
  // backend. Acha qual foto específica é incompatível (ver _local-edr-policy-066), não só que
  // "alguma" é.
  flagUnsupportedForInstagram?: boolean
}) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['image-url', path],
    queryFn: () => api.getImageUrl(path),
  })
  const [unsupported, setUnsupported] = useState(false)

  if (isLoading || !url) {
    return <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-card-2" />
  }

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className={`h-16 w-16 shrink-0 rounded-lg object-cover ${unsupported ? 'ring-2 ring-red-500' : ''}`}
        onLoad={
          flagUnsupportedForInstagram
            ? (e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget
                if (naturalHeight > 0) {
                  setUnsupported(isAspectRatioUnsupportedForInstagram(naturalWidth / naturalHeight))
                }
              }
            : undefined
        }
      />
      {unsupported && (
        <span
          title="Proporção incompatível com o Instagram (fora de 4:5–1.91:1)"
          className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white"
        >
          ⚠
        </span>
      )}
    </div>
  )
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function postWhen(post: ApiPost): Date | null {
  const iso = post.scheduledAt ?? post.publishedAt
  return iso ? new Date(iso) : null
}

function CalendarView({ posts, onSelectPost }: { posts: ApiPost[]; onSelectPost: (postId: string) => void }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const postsByDay = new Map<string, ApiPost[]>()
  for (const post of posts) {
    const when = postWhen(post)
    if (!when) continue
    const key = dayKey(when)
    postsByDay.set(key, [...(postsByDay.get(key) ?? []), post])
  }

  const startOffset = month.getDay()
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - startOffset)
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
  const today = dayKey(new Date())

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="Mês anterior"
          className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:bg-card-2"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-ink">
          {(() => {
            const label = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            return label.charAt(0).toUpperCase() + label.slice(1)
          })()}
        </p>
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Mês seguinte"
          className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:bg-card-2"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const key = dayKey(day)
          const dayPosts = postsByDay.get(key) ?? []
          return (
            <div
              key={key}
              className={`min-h-[88px] rounded-lg border p-1.5 ${
                inMonth ? 'border-line bg-card' : 'border-transparent bg-card-2'
              } ${key === today ? 'ring-2 ring-accent' : ''}`}
            >
              <span className={`text-xs ${inMonth ? 'text-ink' : 'text-muted'}`}>{day.getDate()}</span>
              <ul className="mt-1 space-y-0.5">
                {dayPosts.slice(0, 2).map((post) => {
                  const when = postWhen(post)
                  const isPublished = post.status === 'published'
                  return (
                    <li key={post.id}>
                      <button
                        type="button"
                        onClick={() => onSelectPost(post.id)}
                        title={post.content[0]?.text}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium hover:opacity-80 ${
                          isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-accent-soft text-accent'
                        }`}
                      >
                        {isPublished ? '✓ ' : ''}
                        {when &&
                          when.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                        {post.content[0]?.text}
                      </button>
                    </li>
                  )
                })}
                {dayPosts.length > 2 && (
                  <li className="px-1 text-[10px] text-muted">+{dayPosts.length - 2} mais</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PostCard({
  post,
  highlighted,
  isDraft = false,
  isFailed = false,
}: {
  post: ApiPost
  highlighted: boolean
  isDraft?: boolean
  isFailed?: boolean
}) {
  const queryClient = useQueryClient()
  const firstImage = post.imageStoragePaths[0]
  const targetsInstagram = post.content.some((c) => c.platform === Platform.INSTAGRAM)

  const [isEditing, setIsEditing] = useState(false)
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>(
    Object.fromEntries(post.content.map((c) => [c.platform, c.text])),
  )
  const [images, setImages] = useState<string[]>(post.imageStoragePaths)
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [scheduledAtInput, setScheduledAtInput] = useState(toDatetimeLocalValue(post.scheduledAt))
  const [failedPlatforms, setFailedPlatforms] = useState<Array<{ platform: Platform; reason: string }>>([])

  // Todas as mutações mexem em campos que podem mudar qual lista (agendados/publicados/
  // rascunhos automáticos) o post pertence — mais simples invalidar as três do que rastrear
  // qual state transition aconteceu em cada caso.
  const invalidateAllLists = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'published'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'ai-draft'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'failed'] })
  }

  const updateMutation = useMutation({
    mutationFn: async (input: {
      content: PostContent[]
      images: string[]
      newPhotoFiles: File[]
      scheduledAt: Date | undefined
    }) => {
      const uploadedPaths =
        input.newPhotoFiles.length > 0
          ? await Promise.all(input.newPhotoFiles.map((f) => api.uploadImage(f)))
          : []
      const imageStoragePaths = [...input.images, ...uploadedPaths]
      return api.updatePost(post.id, input.content, imageStoragePaths, input.scheduledAt)
    },
    onSuccess: () => {
      invalidateAllLists()
      setNewPhotoFiles([])
      setIsEditing(false)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => api.publishPost(post.id),
    onSuccess: (data) => {
      invalidateAllLists()
      // O post pode virar "Publicado" com uma ou mais plataformas ausentes — publicar em
      // ao menos uma rede já basta pro status geral, então uma falha isolada (ex: Instagram
      // sem conta business conectada) não vira erro de mutação, só some silenciosamente sem
      // este aviso.
      setFailedPlatforms(data.failedPlatforms)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePost(post.id),
    onSuccess: () => {
      invalidateAllLists()
    },
  })

  const scheduledDate = scheduledAtInput ? new Date(scheduledAtInput) : null
  const scheduledAtValid =
    scheduledDate !== null && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()

  // Rascunho automático sem data pode ser salvo (fica pendente, aguardando aprovação) — um
  // post já agendado sempre precisa de uma data futura válida pra ser salvo. Um post que
  // falhou já tem uma data no passado (a tentativa que falhou); manter essa mesma data
  // intacta continua permitido, pra editar só o texto e tentar de novo sem ser obrigado a
  // reagendar pro futuro.
  const originalScheduledAtInput = toDatetimeLocalValue(post.scheduledAt)
  const canSave =
    (isDraft
      ? scheduledAtInput === '' || scheduledAtValid
      : isFailed
        ? scheduledAtInput === originalScheduledAtInput || scheduledAtValid
        : scheduledAtValid) &&
    post.content.every((c) => {
      const t = texts[c.platform] ?? ''
      return t.trim().length > 0 && t.length <= PLATFORM_CHARACTER_LIMITS[c.platform]
    })

  const handleCancel = () => {
    setTexts(Object.fromEntries(post.content.map((c) => [c.platform, c.text])))
    setImages(post.imageStoragePaths)
    setNewPhotoFiles([])
    setScheduledAtInput(toDatetimeLocalValue(post.scheduledAt))
    setIsEditing(false)
  }

  const handleSave = () => {
    if (!canSave) return
    const content = post.content.map((c) => ({ platform: c.platform, text: texts[c.platform] ?? '' }))
    // scheduledAt "undefined" (não "null") preserva o status atual do post no backend —
    // pra um rascunho sem data isso significa "continua ai-draft", não "vira draft solto".
    const scheduledAt = isDraft && scheduledDate === null ? undefined : (scheduledDate ?? undefined)
    updateMutation.mutate({ content, images, newPhotoFiles, scheduledAt })
  }

  return (
    <li
      id={`post-${post.id}`}
      className={`flex gap-4 rounded-2xl border bg-card p-5 shadow-card ${
        highlighted ? 'border-accent ring-2 ring-accent ring-offset-2' : 'border-line'
      }`}
    >
      {!isEditing && firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {isDraft ? (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              🤖 Aguardando aprovação
            </span>
          ) : isFailed ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
              ❌ Falhou ao publicar
            </span>
          ) : (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
              {post.scheduledAt
                ? new Date(post.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : '—'}
            </span>
          )}
          {post.origin === 'campaign' && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              📸 Campanha
            </span>
          )}
          {post.content.map((c) => (
            <span key={c.platform} className="rounded-full bg-card-2 px-2 py-0.5 text-xs text-muted">
              {PLATFORM_LABELS[c.platform]}
            </span>
          ))}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {post.content.map((c) => {
                const text = texts[c.platform] ?? ''
                const limit = PLATFORM_CHARACTER_LIMITS[c.platform]
                return (
                  <div key={c.platform}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted">{PLATFORM_LABELS[c.platform]}</span>
                      <span
                        className={`text-xs tabular-nums ${
                          text.length > limit ? 'font-bold text-red-600' : 'text-muted'
                        }`}
                      >
                        {limit - text.length}
                      </span>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [c.platform]: e.target.value }))}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-line p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )
              })}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-muted">Fotos</span>
              {targetsInstagram && (
                <p className="mb-1.5 text-xs text-muted">
                  Fotos com <span className="font-semibold text-red-600">⚠</span> têm proporção incompatível com o
                  Instagram (fora de 4:5–1.91:1) — remova ou troque antes de tentar publicar de novo.
                </p>
              )}
              {images.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {images.map((path) => (
                    <li key={path} className="relative">
                      <PostThumbnail path={path} flagUnsupportedForInstagram={targetsInstagram} />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((p) => p !== path))}
                        aria-label="Remover foto"
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white hover:bg-red-600"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {newPhotoFiles.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {newPhotoFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between rounded-lg bg-card-2 px-3 py-1.5 text-xs text-muted"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="ml-2 shrink-0 text-red-500 hover:text-red-700"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                aria-label="Adicionar foto"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  setNewPhotoFiles((prev) => [...prev, ...files])
                  e.target.value = ''
                }}
                className="block w-full text-xs text-muted"
              />
            </div>

            <div>
              <label htmlFor={`scheduledAt-${post.id}`} className="mb-1.5 block text-xs font-medium text-muted">
                Data de publicação
              </label>
              <input
                id={`scheduledAt-${post.id}`}
                type="datetime-local"
                value={scheduledAtInput}
                onChange={(e) => setScheduledAtInput(e.target.value)}
                className="rounded-lg border border-line px-3 py-2 text-sm"
              />
              {isDraft && !scheduledAtInput && (
                <p className="mt-1 text-xs text-muted">
                  Deixe em branco pra continuar como rascunho aguardando aprovação, ou escolha uma data pra agendar.
                </p>
              )}
              {scheduledAtInput && !scheduledAtValid && (
                <p className="mt-1 text-xs text-red-600">A data de publicação deve ser no futuro.</p>
              )}
            </div>

            {updateMutation.isError && (
              <p className="text-xs text-red-600">
                {updateMutation.error instanceof Error ? updateMutation.error.message : 'Erro ao salvar.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSave}
                disabled={!canSave || updateMutation.isPending}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
              >
                {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2 disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="truncate text-sm text-ink">{post.content[0]?.text}</p>
            {publishMutation.isError && (
              <p className="text-xs text-red-600">
                {publishMutation.error instanceof Error ? publishMutation.error.message : 'Erro ao publicar.'}
              </p>
            )}
            {failedPlatforms.length > 0 && (
              <p className="text-xs text-red-600">
                Não publicou em {failedPlatforms.map((f) => PLATFORM_LABELS[f.platform]).join(', ')}:{' '}
                {failedPlatforms.map((f) => f.reason).join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2"
              >
                Editar
              </button>
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
              >
                {publishMutation.isPending
                  ? 'Publicando…'
                  : isDraft
                    ? 'Aprovar e publicar agora'
                    : isFailed
                      ? 'Tentar novamente'
                      : 'Publicar agora'}
              </button>
              <button
                onClick={() => {
                  const message = isDraft
                    ? 'Tem certeza que deseja descartar este rascunho? Ele não será publicado.'
                    : isFailed
                      ? 'Tem certeza que deseja descartar este post que falhou? Ele não será publicado.'
                      : 'Tem certeza que deseja cancelar este agendamento? O post será deletado.'
                  if (confirm(message)) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                {deleteMutation.isPending
                  ? isDraft || isFailed
                    ? 'Descartando…'
                    : 'Cancelando…'
                  : isDraft || isFailed
                    ? 'Descartar'
                    : 'Cancelar agendamento'}
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  )
}

// Uma rede só conta como publicada de fato se tem um externalId (id do post na plataforma) —
// PublishPostUseCase grava um por rede que recebeu o post. Uma rede que estava no alvo do post
// mas não tem externalId falhou na publicação, mesmo que o status geral seja 'published' (o
// status vira 'published' assim que UMA rede dá certo). Sem essa distinção, o card mostrava as
// quatro redes como publicadas mesmo quando o post só chegou numa — o "confuso o que publica e
// o que não" reportado pelo usuário.
function splitPublishOutcome(post: ApiPost): {
  published: Platform[]
  failed: Platform[]
  hasOutcomeData: boolean
} {
  const targeted = post.content.map((c) => c.platform)
  const externalIds = post.externalIds ?? {}
  const hasOutcomeData = Object.keys(externalIds).length > 0
  const published = targeted.filter((p) => externalIds[p])
  const failed = targeted.filter((p) => !externalIds[p])
  return { published, failed, hasOutcomeData }
}

function PublishedPostCard({ post, highlighted }: { post: ApiPost; highlighted: boolean }) {
  const router = useRouter()
  const firstImage = post.imageStoragePaths[0]
  const [showDetail, setShowDetail] = useState(false)
  const { published, failed, hasOutcomeData } = splitPublishOutcome(post)
  // Sem nenhum externalId (post antigo, anterior ao rastreio por rede) caímos no comportamento
  // neutro de antes pra não acusar "falhou" indevidamente em dados legados.
  const showPerPlatform = hasOutcomeData
  const partial = showPerPlatform && failed.length > 0 && published.length > 0

  return (
    <li
      id={`post-${post.id}`}
      className={`flex gap-4 rounded-2xl border bg-card p-5 shadow-card ${
        highlighted ? 'border-accent ring-2 ring-accent ring-offset-2' : 'border-line'
      }`}
    >
      {firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {partial ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              ⚠ Publicado em parte
              {post.publishedAt
                ? ` em ${new Date(post.publishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                : ''}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              ✓ Publicado
              {post.publishedAt
                ? ` em ${new Date(post.publishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                : ''}
            </span>
          )}
          {post.origin === 'autonomy-tick' && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              🤖 Automático
            </span>
          )}
          {post.origin === 'campaign' && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              📸 Campanha
            </span>
          )}
          {showPerPlatform
            ? post.content.map((c) => {
                const ok = published.includes(c.platform)
                return (
                  <span
                    key={c.platform}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                    title={ok ? 'Publicado nesta rede' : 'Não chegou a publicar nesta rede'}
                  >
                    {ok ? '✓' : '✕'} {PLATFORM_LABELS[c.platform]}
                  </span>
                )
              })
            : post.content.map((c) => (
                <span key={c.platform} className="rounded-full bg-card-2 px-2 py-0.5 text-xs text-muted">
                  {PLATFORM_LABELS[c.platform]}
                </span>
              ))}
        </div>
        {partial && (
          <p className="text-xs text-amber-700">
            Este post não chegou a {failed.map((p) => PLATFORM_LABELS[p]).join(', ')}. Confira se essa(s)
            rede(s) está(ão) conectada(s) na Central de Contas e tente republicar.
          </p>
        )}
        <p className="truncate text-sm text-ink">{post.content[0]?.text}</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowDetail(true)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card-2"
          >
            Ver post completo
          </button>
          <button
            onClick={() => router.push(`/dashboard/compose?repostFrom=${post.id}`)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
          >
            Repostar
          </button>
        </div>
      </div>
      {showDetail && <PostDetailModal post={post} onClose={() => setShowDetail(false)} />}
    </li>
  )
}

function sortByWhen(posts: ApiPost[], direction: 'desc' | 'asc'): ApiPost[] {
  return [...posts].sort((a, b) => {
    const diff = (postWhen(a)?.getTime() ?? 0) - (postWhen(b)?.getTime() ?? 0)
    return direction === 'desc' ? -diff : diff
  })
}

export default function ScheduledPostsPage() {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null)
  // Mais recente primeiro por padrão (pedido do usuário) — o usuário pode inverter.
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')

  const scheduledQuery = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => api.getPosts('scheduled'),
  })
  const publishedQuery = useQuery({
    queryKey: ['posts', 'published'],
    queryFn: () => api.getPosts('published'),
  })
  const draftQuery = useQuery({
    queryKey: ['posts', 'ai-draft'],
    queryFn: () => api.getPosts('ai-draft'),
  })
  const failedQuery = useQuery({
    queryKey: ['posts', 'failed'],
    queryFn: () => api.getPosts('failed'),
  })

  const scheduledPosts = sortByWhen(
    (scheduledQuery.data ?? []).filter((p) => p.status === 'scheduled'),
    sortDirection,
  )
  const publishedPosts = sortByWhen(
    (publishedQuery.data ?? []).filter((p) => p.status === 'published'),
    sortDirection,
  )
  // Só rascunhos do tick de autonomia (modo semi-automático) — geração manual via
  // /dashboard/generate também passa por status 'ai-draft', mas nunca fica pendente: o
  // próprio fluxo de publicar/agendar já cria um Post novo na hora, deixando esse rascunho
  // original órfão. Sem o filtro por origin, esta lista ficaria cheia de lixo antigo.
  const draftPosts = [...(draftQuery.data ?? [])]
    .filter((p) => p.status === 'ai-draft' && p.origin === 'autonomy-tick')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  // Post que falhou em todas as redes-alvo (PublishPostUseCase só marca 'failed' quando
  // nenhuma plataforma publicou) — sem esta lista ele desaparecia da tela ao virar 'failed',
  // sem lugar nenhum pra reaparecer, editar ou tentar de novo.
  const failedPosts = sortByWhen(
    (failedQuery.data ?? []).filter((p) => p.status === 'failed'),
    sortDirection,
  )
  const calendarPosts = [...scheduledPosts, ...publishedPosts]
  const isLoading = scheduledQuery.isLoading || publishedQuery.isLoading
  const error = scheduledQuery.error ?? publishedQuery.error
  const isEmpty = scheduledPosts.length === 0 && publishedPosts.length === 0

  useSelfieNarrateOnReady(
    !isLoading && !error ? buildScheduleSummary(scheduledPosts, publishedPosts) : null,
  )

  useEffect(() => {
    if (!highlightedPostId) return
    document.getElementById(`post-${highlightedPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timeout = setTimeout(() => setHighlightedPostId(null), 3000)
    return () => clearTimeout(timeout)
  }, [highlightedPostId])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Painel da marca</p>
          <h1 className="text-2xl font-bold text-ink">Posts Agendados</h1>
        </div>
        <div className="ml-auto flex gap-2 rounded-lg border border-line p-1">
          <button
            onClick={() => setView('list')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              view === 'list' ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-card-2'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              view === 'calendar' ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-card-2'
            }`}
          >
            Calendário
          </button>
        </div>
      </div>

      {draftPosts.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">🤖 Aguardando sua aprovação</h2>
            <p className="text-xs text-muted">
              O modo semi-automático gerou{' '}
              {draftPosts.length === 1 ? 'este post' : `estes ${draftPosts.length} posts`} e está esperando você
              revisar antes de publicar — aprove, edite, agende para depois ou descarte.
            </p>
          </div>
          <ul className="space-y-3">
            {draftPosts.map((post) => (
              <PostCard key={post.id} post={post} highlighted={false} isDraft />
            ))}
          </ul>
        </div>
      )}
      {draftQuery.isError && (
        <p className="text-xs text-red-600">Não foi possível carregar os rascunhos automáticos aguardando aprovação.</p>
      )}

      {failedPosts.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">❌ Falhou ao publicar</h2>
            <p className="text-xs text-muted">
              {failedPosts.length === 1 ? 'Este post não conseguiu' : `Estes ${failedPosts.length} posts não conseguiram`}{' '}
              publicar em nenhuma rede. Edite, tente de novo, ou descarte.
            </p>
          </div>
          <ul className="space-y-3">
            {failedPosts.map((post) => (
              <PostCard key={post.id} post={post} highlighted={post.id === highlightedPostId} isFailed />
            ))}
          </ul>
        </div>
      )}
      {failedQuery.isError && (
        <p className="text-xs text-red-600">Não foi possível carregar os posts que falharam ao publicar.</p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Carregando…
        </div>
      ) : error ? (
        <div className="space-y-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="break-words">
            Não foi possível carregar os posts agendados.
            {error instanceof Error && error.message ? ` [${error.message}]` : ''}
          </p>
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-muted">
          Nenhum post agendado ainda. Gere ou componha um post e escolha uma data para publicação.
        </p>
      ) : view === 'calendar' ? (
        <CalendarView
          posts={calendarPosts}
          onSelectPost={(postId) => {
            setView('list')
            setHighlightedPostId(postId)
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2"
            >
              {sortDirection === 'desc' ? '↓ Mais recentes primeiro' : '↑ Mais antigos primeiro'}
            </button>
          </div>
          {scheduledPosts.length > 0 && (
            <ul className="space-y-3">
              {scheduledPosts.map((post) => (
                <PostCard key={post.id} post={post} highlighted={post.id === highlightedPostId} />
              ))}
            </ul>
          )}
          {publishedPosts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink">Publicados</h2>
              <ul className="space-y-3">
                {publishedPosts.map((post) => (
                  <PublishedPostCard key={post.id} post={post} highlighted={post.id === highlightedPostId} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
