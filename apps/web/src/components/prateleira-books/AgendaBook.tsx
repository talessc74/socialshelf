'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Platform, PLATFORM_CHARACTER_LIMITS, PLATFORM_MEDIA_SUPPORT } from '@socialshelf/domain'
import { api } from '../../lib/api'
import type { ApiPost, PostContent } from '../../lib/api'

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

function postWhen(post: ApiPost): Date | null {
  const iso = post.scheduledAt ?? post.publishedAt
  return iso ? new Date(iso) : null
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

interface AgendaContextValue {
  isLoading: boolean
  isError: boolean
  posts: ApiPost[]
  month: Date
  setMonth: (updater: (d: Date) => Date) => void
  selectedPostId: string | null
  selectPost: (id: string | null) => void
  selectedPost: ApiPost | null
}

const AgendaContext = createContext<AgendaContextValue | null>(null)

export function AgendaProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)

  const scheduledQuery = useQuery({ queryKey: ['posts', 'scheduled'], queryFn: () => api.getPosts('scheduled') })
  const publishedQuery = useQuery({ queryKey: ['posts', 'published'], queryFn: () => api.getPosts('published') })

  const posts = [...(scheduledQuery.data ?? []), ...(publishedQuery.data ?? [])]
  const isLoading = scheduledQuery.isLoading || publishedQuery.isLoading
  const isError = !!scheduledQuery.error || !!publishedQuery.error

  const value: AgendaContextValue = {
    isLoading,
    isError,
    posts,
    month,
    setMonth: (updater) => setMonth(updater),
    selectedPostId,
    selectPost: setSelectedPostId,
    selectedPost: posts.find((p) => p.id === selectedPostId) ?? null,
  }

  return <AgendaContext.Provider value={value}>{children}</AgendaContext.Provider>
}

function useAgenda(): AgendaContextValue {
  const ctx = useContext(AgendaContext)
  if (!ctx) throw new Error('useAgenda deve ser usado dentro de AgendaProvider')
  return ctx
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function MonthCalendar({ compact }: { compact?: boolean }) {
  const { posts, month, setMonth, selectPost } = useAgenda()

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
  const cellH = compact ? '34px' : '58px'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="text-xs"
          style={{ color: 'rgba(0,0,0,0.4)' }}
          aria-label="Mês anterior"
        >
          ←
        </button>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: 'rgba(0,0,0,0.75)' }}>
          {(() => {
            const label = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            return label.charAt(0).toUpperCase() + label.slice(1)
          })()}
        </p>
        <button
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="text-xs"
          style={{ color: 'rgba(0,0,0,0.4)' }}
          aria-label="Mês seguinte"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {WEEKDAY_LABELS.map((w, i) => (
          <span
            key={i}
            className="text-center"
            style={{ fontSize: '8px', fontWeight: 700, color: 'rgba(0,0,0,0.35)' }}
          >
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const key = dayKey(day)
          const dayPosts = postsByDay.get(key) ?? []
          const isToday = key === today
          return (
            <div
              key={key}
              className="p-0.5"
              style={{
                minHeight: cellH,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                borderRight: '1px solid rgba(0,0,0,0.06)',
                background: isToday ? 'rgba(200,40,30,0.06)' : 'transparent',
                opacity: inMonth ? 1 : 0.3,
              }}
            >
              <span style={{ fontSize: '8px', color: isToday ? '#c8281e' : 'rgba(0,0,0,0.5)', fontWeight: isToday ? 700 : 400 }}>
                {day.getDate()}
              </span>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {dayPosts.slice(0, compact ? 2 : 4).map((post) => (
                  <button
                    key={post.id}
                    onClick={() => selectPost(post.id)}
                    title={post.content[0]?.text}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: post.status === 'published' ? '#3f8f5f' : '#c9a84c' }}
                    aria-label={post.status === 'published' ? 'Post publicado' : 'Post agendado'}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center gap-3" style={{ fontSize: '9px', color: 'rgba(0,0,0,0.45)' }}>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#c9a84c' }} /> agendado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#3f8f5f' }} /> publicado
        </span>
      </div>
    </div>
  )
}

function PostListRow({ post }: { post: ApiPost }) {
  const { selectPost } = useAgenda()
  const when = postWhen(post)
  const isPublished = post.status === 'published'

  return (
    <li>
      <button
        onClick={() => selectPost(post.id)}
        className="w-full text-left rounded px-2 py-1.5 hover:bg-black/[0.03] transition-colors"
        style={{ borderLeft: `2px solid ${isPublished ? '#3f8f5f' : '#c9a84c'}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <span style={{ fontSize: '9px', fontWeight: 700, color: isPublished ? '#3f8f5f' : '#8a6a1a' }}>
            {isPublished ? '✓ publicado' : 'agendado'} {when ? `· ${when.toLocaleDateString('pt-BR')}` : ''}
          </span>
          <span style={{ fontSize: '8px', color: 'rgba(0,0,0,0.35)' }}>
            {when?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="truncate" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.72)' }}>
          {post.content[0]?.text}
        </p>
      </button>
    </li>
  )
}

function ScheduledEditPanel({ post, onDone }: { post: ApiPost; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>(
    Object.fromEntries(post.content.map((c) => [c.platform, c.text])),
  )
  const [images, setImages] = useState<string[]>(post.imageStoragePaths)
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [scheduledAtInput, setScheduledAtInput] = useState(toDatetimeLocalValue(post.scheduledAt))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'published'] })
  }

  const updateMutation = useMutation({
    mutationFn: async (input: { content: PostContent[]; images: string[]; newPhotoFiles: File[]; scheduledAt: Date }) => {
      const uploadedPaths =
        input.newPhotoFiles.length > 0 ? await Promise.all(input.newPhotoFiles.map((f) => api.uploadImage(f))) : []
      const imageStoragePaths = [...input.images, ...uploadedPaths]
      return api.updatePost(post.id, input.content, imageStoragePaths, input.scheduledAt)
    },
    onSuccess: () => {
      invalidate()
      onDone()
    },
  })

  const scheduledDate = scheduledAtInput ? new Date(scheduledAtInput) : null
  const scheduledAtValid = scheduledDate !== null && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()
  const canSave =
    scheduledAtValid &&
    post.content.every((c) => {
      const t = texts[c.platform] ?? ''
      return t.trim().length > 0 && t.length <= PLATFORM_CHARACTER_LIMITS[c.platform]
    })

  const labelStyle = { fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.4)' }
  const inputStyle = { fontSize: '11px', color: 'rgba(0,0,0,0.8)', border: '1px solid rgba(0,0,0,0.12)' }

  return (
    <div className="space-y-3">
      {post.content.map((c) => {
        const text = texts[c.platform] ?? ''
        const limit = PLATFORM_CHARACTER_LIMITS[c.platform]
        return (
          <div key={c.platform}>
            <div className="mb-1 flex items-center justify-between">
              <p style={labelStyle}>{PLATFORM_LABELS[c.platform]}</p>
              <span style={{ fontSize: '9px', color: text.length > limit ? '#a34a2f' : 'rgba(0,0,0,0.4)' }}>{limit - text.length}</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setTexts((prev) => ({ ...prev, [c.platform]: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded p-2"
              style={inputStyle}
            />
          </div>
        )
      })}

      <div>
        <p style={labelStyle} className="mb-1">Fotos</p>
        {images.length > 0 && (
          <ul className="mb-1.5 space-y-1">
            {images.map((path) => (
              <li key={path} className="flex items-center justify-between rounded px-2 py-1" style={{ background: 'rgba(0,0,0,0.04)', fontSize: '10px' }}>
                <span className="truncate" style={{ color: 'rgba(0,0,0,0.6)' }}>{path.split('/').pop()}</span>
                <button type="button" onClick={() => setImages((prev) => prev.filter((p) => p !== path))} style={{ color: '#a34a2f' }}>
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}
        {newPhotoFiles.length > 0 && (
          <ul className="mb-1.5 space-y-1">
            {newPhotoFiles.map((file, i) => (
              <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded px-2 py-1" style={{ background: 'rgba(0,0,0,0.04)', fontSize: '10px' }}>
                <span className="truncate" style={{ color: 'rgba(0,0,0,0.6)' }}>{file.name}</span>
                <button type="button" onClick={() => setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))} style={{ color: '#a34a2f' }}>
                  remover
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
          style={{ fontSize: '10px', color: 'rgba(0,0,0,0.5)' }}
          className="block w-full"
        />
      </div>

      <div>
        <label htmlFor={`scheduledAt-${post.id}`} style={labelStyle} className="mb-1 block">Data de publicação</label>
        <input
          id={`scheduledAt-${post.id}`}
          type="datetime-local"
          value={scheduledAtInput}
          onChange={(e) => setScheduledAtInput(e.target.value)}
          className="rounded px-2 py-1"
          style={inputStyle}
        />
        {scheduledAtInput && !scheduledAtValid && (
          <p className="mt-1" style={{ fontSize: '9px', color: '#a34a2f' }}>A data de publicação deve ser no futuro.</p>
        )}
      </div>

      {updateMutation.isError && (
        <p style={{ fontSize: '9px', color: '#a34a2f' }}>
          {updateMutation.error instanceof Error ? updateMutation.error.message : 'Erro ao salvar.'}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => {
            if (!canSave || !scheduledDate) return
            const content = post.content.map((c) => ({ platform: c.platform, text: texts[c.platform] ?? '' }))
            updateMutation.mutate({ content, images, newPhotoFiles, scheduledAt: scheduledDate })
          }}
          disabled={!canSave || updateMutation.isPending}
          className="rounded-full px-3 py-1 text-[10px] font-semibold disabled:opacity-40"
          style={{ background: '#c9a84c', color: '#241d10' }}
        >
          {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
        </button>
        <button
          onClick={onDone}
          disabled={updateMutation.isPending}
          className="rounded-full px-3 py-1 text-[10px] font-semibold disabled:opacity-40"
          style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function RepostPanel({ post, onDone }: { post: ApiPost; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { data: connections } = useQuery({ queryKey: ['connections'], queryFn: () => api.getConnections() })
  const connectedPlatforms = new Set((connections ?? []).map((c) => c.platform as Platform))

  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set(post.content.map((c) => c.platform)))
  const firstText = post.content[0]?.text ?? ''
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>(
    Object.fromEntries(post.content.map((c) => [c.platform, c.text])),
  )
  const hasImages = post.imageStoragePaths.length > 0

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'published'] })
  }

  const publishNowMutation = useMutation({
    mutationFn: async () => {
      const content: PostContent[] = Array.from(selectedPlatforms).map((p) => ({ platform: p, text: texts[p] ?? firstText }))
      const created = await api.createPost(content, post.imageStoragePaths)
      return api.publishPost(created.id)
    },
    onSuccess: () => {
      invalidate()
      onDone()
    },
  })

  const togglePlatform = (p: Platform) => {
    if (PLATFORM_MEDIA_SUPPORT[p].requiresImage && !hasImages) return
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else {
        next.add(p)
        if (!(p in texts)) setTexts((t) => ({ ...t, [p]: firstText }))
      }
      return next
    })
  }

  const canPublish = selectedPlatforms.size > 0 && Array.from(selectedPlatforms).every((p) => (texts[p] ?? firstText).trim().length > 0)

  const labelStyle = { fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(0,0,0,0.4)' }

  return (
    <div className="space-y-3">
      <div>
        <p style={labelStyle} className="mb-1.5">Repostar em</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(Platform).map((p) => {
            const isConnected = connectedPlatforms.has(p)
            const blocked = PLATFORM_MEDIA_SUPPORT[p].requiresImage && !hasImages
            const active = selectedPlatforms.has(p)
            return (
              <button
                key={p}
                type="button"
                disabled={!isConnected || blocked}
                onClick={() => togglePlatform(p)}
                title={blocked ? 'Requer imagem' : !isConnected ? 'Rede não conectada' : undefined}
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold disabled:opacity-30"
                style={{ background: active ? '#c9a84c' : 'rgba(0,0,0,0.06)', color: active ? '#241d10' : 'rgba(0,0,0,0.6)' }}
              >
                {PLATFORM_LABELS[p]}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        {Array.from(selectedPlatforms).map((p) => {
          const text = texts[p] ?? firstText
          const limit = PLATFORM_CHARACTER_LIMITS[p]
          return (
            <div key={p}>
              <div className="mb-1 flex items-center justify-between">
                <p style={labelStyle}>{PLATFORM_LABELS[p]}</p>
                <span style={{ fontSize: '9px', color: text.length > limit ? '#a34a2f' : 'rgba(0,0,0,0.4)' }}>{limit - text.length}</span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setTexts((prev) => ({ ...prev, [p]: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded p-2"
                style={{ fontSize: '11px', color: 'rgba(0,0,0,0.8)', border: '1px solid rgba(0,0,0,0.12)' }}
              />
            </div>
          )
        })}
      </div>

      {publishNowMutation.isError && (
        <p style={{ fontSize: '9px', color: '#a34a2f' }}>
          {publishNowMutation.error instanceof Error ? publishNowMutation.error.message : 'Erro ao repostar.'}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => publishNowMutation.mutate()}
          disabled={!canPublish || publishNowMutation.isPending}
          className="rounded-full px-3 py-1 text-[10px] font-semibold disabled:opacity-40"
          style={{ background: '#c9a84c', color: '#241d10' }}
        >
          {publishNowMutation.isPending ? 'Publicando…' : 'Publicar agora'}
        </button>
        <button
          onClick={onDone}
          disabled={publishNowMutation.isPending}
          className="rounded-full px-3 py-1 text-[10px] font-semibold disabled:opacity-40"
          style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function PostDetail() {
  const { selectedPost, selectPost } = useAgenda()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'view' | 'edit' | 'repost'>('view')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'published'] })
  }

  const publishMutation = useMutation({
    mutationFn: () => api.publishPost(selectedPost!.id),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deletePost(selectedPost!.id),
    onSuccess: () => {
      invalidate()
      selectPost(null)
    },
  })

  if (!selectedPost) return null
  const when = postWhen(selectedPost)
  const isPublished = selectedPost.status === 'published'

  return (
    <div>
      <button
        onClick={() => (mode === 'view' ? selectPost(null) : setMode('view'))}
        className="mb-3 block text-[10px] font-semibold"
        style={{ color: 'rgba(0,0,0,0.5)' }}
      >
        {mode === 'view' ? '← voltar à lista' : '← voltar aos detalhes'}
      </button>

      <span
        className="inline-block rounded-full px-2 py-0.5 text-[9px] font-bold mb-2"
        style={{ background: isPublished ? '#3f8f5f' : '#c9a84c', color: isPublished ? '#fff' : '#241d10' }}
      >
        {isPublished ? '✓ Publicado' : 'Agendado'} {when ? `em ${when.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
      </span>

      <div className="flex flex-wrap gap-1 mb-3">
        {selectedPost.content.map((c) => (
          <span key={c.platform} className="rounded-full px-2 py-0.5 text-[9px]" style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)' }}>
            {PLATFORM_LABELS[c.platform]}
          </span>
        ))}
      </div>

      {mode === 'edit' && !isPublished ? (
        <ScheduledEditPanel post={selectedPost} onDone={() => setMode('view')} />
      ) : mode === 'repost' && isPublished ? (
        <RepostPanel post={selectedPost} onDone={() => setMode('view')} />
      ) : (
        <>
          {selectedPost.imageStoragePaths.length > 0 && (
            <div className="mb-3 h-24 w-full rounded bg-black/[0.04] flex items-center justify-center" style={{ fontSize: '9px', color: 'rgba(0,0,0,0.35)' }}>
              {selectedPost.imageStoragePaths.length} imagem(ns)
            </div>
          )}

          <div className="space-y-3 mb-3">
            {selectedPost.content.map((c) => (
              <div key={c.platform}>
                <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1">
                  {PLATFORM_LABELS[c.platform]}
                </p>
                <p style={{ fontSize: '11px', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>{c.text}</p>
              </div>
            ))}
          </div>

          {(publishMutation.isError || deleteMutation.isError) && (
            <p className="mb-2" style={{ fontSize: '9px', color: '#a34a2f' }}>
              {(publishMutation.error instanceof Error && publishMutation.error.message) ||
                (deleteMutation.error instanceof Error && deleteMutation.error.message) ||
                'Ocorreu um erro.'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {isPublished ? (
              <button
                onClick={() => setMode('repost')}
                className="rounded-full px-3 py-1 text-[10px] font-semibold"
                style={{ background: '#c9a84c', color: '#241d10' }}
              >
                Repostar
              </button>
            ) : (
              <>
                <button
                  onClick={() => setMode('edit')}
                  className="rounded-full px-3 py-1 text-[10px] font-semibold"
                  style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="rounded-full px-3 py-1 text-[10px] font-semibold disabled:opacity-40"
                  style={{ background: '#c9a84c', color: '#241d10' }}
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
                  className="rounded-full px-3 py-1 text-[10px] font-semibold disabled:opacity-40"
                  style={{ background: 'rgba(163,74,47,0.1)', color: '#a34a2f' }}
                >
                  {deleteMutation.isPending ? 'Cancelando…' : 'Cancelar agendamento'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function AgendaDesktopLeft() {
  const { isLoading, isError } = useAgenda()
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Carregando…
      </div>
    )
  }
  if (isError) return <p className="text-xs" style={{ color: '#a34a2f' }}>Não foi possível carregar a agenda.</p>
  return <MonthCalendar />
}

export function AgendaDesktopRight() {
  const { posts, selectedPost, isLoading } = useAgenda()
  if (isLoading) return <></>
  if (selectedPost) return <PostDetail />

  const scheduled = posts.filter((p) => p.status === 'scheduled').sort((a, b) => (postWhen(a)?.getTime() ?? 0) - (postWhen(b)?.getTime() ?? 0))
  const published = posts.filter((p) => p.status === 'published').sort((a, b) => (postWhen(b)?.getTime() ?? 0) - (postWhen(a)?.getTime() ?? 0))

  if (posts.length === 0) {
    return <p className="text-xs italic" style={{ color: 'rgba(0,0,0,0.4)' }}>Nenhum post agendado ou publicado ainda.</p>
  }

  return (
    <div>
      {scheduled.length > 0 && (
        <>
          <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
            Agendados
          </p>
          <ul className="mb-4 space-y-0.5">
            {scheduled.map((p) => (
              <PostListRow key={p.id} post={p} />
            ))}
          </ul>
        </>
      )}
      {published.length > 0 && (
        <>
          <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
            Publicados
          </p>
          <ul className="space-y-0.5">
            {published.map((p) => (
              <PostListRow key={p.id} post={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const MOBILE_PAGES = ['calendario', 'lista'] as const

export function AgendaMobile() {
  const { posts, selectedPost, isLoading, isError } = useAgenda()
  const [pageIndex, setPageIndex] = useState(0)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Carregando…
      </div>
    )
  }
  if (isError) return <p className="text-xs" style={{ color: '#a34a2f' }}>Não foi possível carregar a agenda.</p>

  if (selectedPost) return <PostDetail />

  const page = MOBILE_PAGES[pageIndex]
  const scheduled = posts.filter((p) => p.status === 'scheduled').sort((a, b) => (postWhen(a)?.getTime() ?? 0) - (postWhen(b)?.getTime() ?? 0))
  const published = posts.filter((p) => p.status === 'published').sort((a, b) => (postWhen(b)?.getTime() ?? 0) - (postWhen(a)?.getTime() ?? 0))

  return (
    <div className="flex flex-col gap-3">
      {page === 'calendario' && <MonthCalendar compact />}

      {page === 'lista' &&
        (posts.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'rgba(0,0,0,0.4)' }}>Nenhum post agendado ou publicado ainda.</p>
        ) : (
          <div>
            {scheduled.length > 0 && (
              <>
                <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
                  Agendados
                </p>
                <ul className="mb-4 space-y-0.5">
                  {scheduled.map((p) => (
                    <PostListRow key={p.id} post={p} />
                  ))}
                </ul>
              </>
            )}
            {published.length > 0 && (
              <>
                <p style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1.5">
                  Publicados
                </p>
                <ul className="space-y-0.5">
                  {published.map((p) => (
                    <PostListRow key={p.id} post={p} />
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}

      <div className="flex items-center justify-between pt-1">
        <button
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
          className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
          style={{ color: 'rgba(0,0,0,0.6)' }}
        >
          ← Anterior
        </button>
        <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>
          {pageIndex + 1} / {MOBILE_PAGES.length}
        </span>
        <button
          disabled={pageIndex === MOBILE_PAGES.length - 1}
          onClick={() => setPageIndex((p) => Math.min(MOBILE_PAGES.length - 1, p + 1))}
          className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
          style={{ color: 'rgba(0,0,0,0.6)' }}
        >
          Próxima →
        </button>
      </div>
    </div>
  )
}
