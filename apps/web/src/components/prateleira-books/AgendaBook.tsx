'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import { api } from '../../lib/api'
import type { ApiPost } from '../../lib/api'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
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

function PostDetail() {
  const { selectedPost, selectPost } = useAgenda()
  if (!selectedPost) return null
  const when = postWhen(selectedPost)
  const isPublished = selectedPost.status === 'published'

  return (
    <div>
      <button onClick={() => selectPost(null)} className="mb-3 block text-[10px] font-semibold" style={{ color: 'rgba(0,0,0,0.5)' }}>
        ← voltar à lista
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

      {selectedPost.imageStoragePaths.length > 0 && (
        <div className="mb-3 h-24 w-full rounded bg-black/[0.04] flex items-center justify-center" style={{ fontSize: '9px', color: 'rgba(0,0,0,0.35)' }}>
          {selectedPost.imageStoragePaths.length} imagem(ns)
        </div>
      )}

      <div className="space-y-3">
        {selectedPost.content.map((c) => (
          <div key={c.platform}>
            <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }} className="mb-1">
              {PLATFORM_LABELS[c.platform]}
            </p>
            <p style={{ fontSize: '11px', lineHeight: 1.55, color: 'rgba(0,0,0,0.72)' }}>{c.text}</p>
          </div>
        ))}
      </div>
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
