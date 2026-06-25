'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform, PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type { ApiPost, PostContent } from '../../../lib/api'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function PostThumbnail({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading || !url) {
    return <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-gray-100" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
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
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="Mês anterior"
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-gray-900">
          {(() => {
            const label = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            return label.charAt(0).toUpperCase() + label.slice(1)
          })()}
        </p>
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Mês seguinte"
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-gray-400">
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
                inMonth ? 'border-gray-100 bg-white' : 'border-transparent bg-gray-50'
              } ${key === today ? 'ring-2 ring-brand-500' : ''}`}
            >
              <span className={`text-xs ${inMonth ? 'text-gray-700' : 'text-gray-300'}`}>{day.getDate()}</span>
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
                          isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'
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
                  <li className="px-1 text-[10px] text-gray-400">+{dayPosts.length - 2} mais</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PostCard({ post, highlighted }: { post: ApiPost; highlighted: boolean }) {
  const queryClient = useQueryClient()
  const firstImage = post.imageStoragePaths[0]

  const [isEditing, setIsEditing] = useState(false)
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>(
    Object.fromEntries(post.content.map((c) => [c.platform, c.text])),
  )
  const [images, setImages] = useState<string[]>(post.imageStoragePaths)
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [scheduledAtInput, setScheduledAtInput] = useState(toDatetimeLocalValue(post.scheduledAt))

  const updateMutation = useMutation({
    mutationFn: async (input: {
      content: PostContent[]
      images: string[]
      newPhotoFiles: File[]
      scheduledAt: Date
    }) => {
      const uploadedPaths =
        input.newPhotoFiles.length > 0
          ? await Promise.all(input.newPhotoFiles.map((f) => api.uploadImage(f)))
          : []
      const imageStoragePaths = [...input.images, ...uploadedPaths]
      return api.updatePost(post.id, input.content, imageStoragePaths, input.scheduledAt)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
      setNewPhotoFiles([])
      setIsEditing(false)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => api.publishPost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
      queryClient.invalidateQueries({ queryKey: ['posts', 'published'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
    },
  })

  const scheduledDate = scheduledAtInput ? new Date(scheduledAtInput) : null
  const scheduledAtValid =
    scheduledDate !== null && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()

  const canSave =
    scheduledAtValid &&
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
    if (!canSave || !scheduledDate) return
    const content = post.content.map((c) => ({ platform: c.platform, text: texts[c.platform] ?? '' }))
    updateMutation.mutate({ content, images, newPhotoFiles, scheduledAt: scheduledDate })
  }

  return (
    <li
      id={`post-${post.id}`}
      className={`flex gap-4 rounded-2xl border bg-white p-5 shadow-sm shadow-brand-100/60 ${
        highlighted ? 'border-brand-500 ring-2 ring-brand-500 ring-offset-2' : 'border-brand-100'
      }`}
    >
      {!isEditing && firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
            {post.scheduledAt
              ? new Date(post.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
              : '—'}
          </span>
          {post.content.map((c) => (
            <span key={c.platform} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
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
                      <span className="text-xs font-medium text-gray-500">{PLATFORM_LABELS[c.platform]}</span>
                      <span
                        className={`text-xs tabular-nums ${
                          text.length > limit ? 'font-bold text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {limit - text.length}
                      </span>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [c.platform]: e.target.value }))}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-gray-200 p-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )
              })}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-500">Fotos</span>
              {images.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {images.map((path) => (
                    <li key={path} className="relative">
                      <PostThumbnail path={path} />
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
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600"
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
                className="block w-full text-xs text-gray-600"
              />
            </div>

            <div>
              <label htmlFor={`scheduledAt-${post.id}`} className="mb-1.5 block text-xs font-medium text-gray-500">
                Data de publicação
              </label>
              <input
                id={`scheduledAt-${post.id}`}
                type="datetime-local"
                value={scheduledAtInput}
                onChange={(e) => setScheduledAtInput(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {scheduledAtInput && !scheduledAtValid && (
                <p className="mt-1 text-xs text-red-600">A data de publicação deve ser no futuro.</p>
              )}
            </div>

            {updateMutation.isError && (
              <p className="text-xs text-red-600">
                {updateMutation.error instanceof Error ? updateMutation.error.message : 'Erro ao salvar.'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!canSave || updateMutation.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="truncate text-sm text-gray-800">{post.content[0]?.text}</p>
            {publishMutation.isError && (
              <p className="text-xs text-red-600">
                {publishMutation.error instanceof Error ? publishMutation.error.message : 'Erro ao publicar.'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {publishMutation.isPending ? 'Publicando…' : 'Publicar agora'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Tem certeza que deseja cancelar este agendamento? O post será deletado.')) {
                    deleteMutation.mutate()
                  }
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                {deleteMutation.isPending ? 'Cancelando…' : 'Cancelar agendamento'}
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  )
}

function PublishedPostCard({ post, highlighted }: { post: ApiPost; highlighted: boolean }) {
  const router = useRouter()
  const firstImage = post.imageStoragePaths[0]

  return (
    <li
      id={`post-${post.id}`}
      className={`flex gap-4 rounded-2xl border bg-white p-5 shadow-sm shadow-brand-100/60 ${
        highlighted ? 'border-brand-500 ring-2 ring-brand-500 ring-offset-2' : 'border-gray-100'
      }`}
    >
      {firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            ✓ Publicado
            {post.publishedAt
              ? ` em ${new Date(post.publishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
              : ''}
          </span>
          {post.content.map((c) => (
            <span key={c.platform} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {PLATFORM_LABELS[c.platform]}
            </span>
          ))}
        </div>
        <p className="truncate text-sm text-gray-800">{post.content[0]?.text}</p>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/dashboard/compose?repostFrom=${post.id}`)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Repostar
          </button>
        </div>
      </div>
    </li>
  )
}

export default function ScheduledPostsPage() {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'calendar'>('calendar')
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null)

  const scheduledQuery = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => api.getPosts('scheduled'),
  })
  const publishedQuery = useQuery({
    queryKey: ['posts', 'published'],
    queryFn: () => api.getPosts('published'),
  })

  const scheduledPosts = (scheduledQuery.data ?? []).filter((p) => p.status === 'scheduled')
  const publishedPosts = (publishedQuery.data ?? []).filter((p) => p.status === 'published')
  const calendarPosts = [...scheduledPosts, ...publishedPosts]
  const isLoading = scheduledQuery.isLoading || publishedQuery.isLoading
  const error = scheduledQuery.error ?? publishedQuery.error
  const isEmpty = scheduledPosts.length === 0 && publishedPosts.length === 0

  useEffect(() => {
    if (!highlightedPostId) return
    document.getElementById(`post-${highlightedPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timeout = setTimeout(() => setHighlightedPostId(null), 3000)
    return () => clearTimeout(timeout)
  }, [highlightedPostId])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Painel da marca</p>
          <h1 className="text-2xl font-bold text-gray-900">Posts Agendados</h1>
        </div>
        <div className="ml-auto flex gap-2 rounded-lg border border-gray-200 p-1">
          <button
            onClick={() => setView('list')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              view === 'list' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              view === 'calendar' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Calendário
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
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
        <p className="text-sm text-gray-500">
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
          {scheduledPosts.length > 0 && (
            <ul className="space-y-3">
              {scheduledPosts.map((post) => (
                <PostCard key={post.id} post={post} highlighted={post.id === highlightedPostId} />
              ))}
            </ul>
          )}
          {publishedPosts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Publicados</h2>
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
