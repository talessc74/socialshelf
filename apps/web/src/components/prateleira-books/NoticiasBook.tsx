'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Newspaper } from 'lucide-react'
import Link from 'next/link'
import { api } from '../../lib/api'
import type { ApiTopicSuggestion } from '../../lib/api'

interface NoticiasContextValue {
  suggestions: ApiTopicSuggestion[]
  isLoading: boolean
  isError: boolean
  query: string
  setQuery: (v: string) => void
  search: () => void
  searchResults: ApiTopicSuggestion[] | null
  searching: boolean
  searchError: boolean
}

const NoticiasContext = createContext<NoticiasContextValue | null>(null)

export function NoticiasProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: () => api.getTopicSuggestions(),
  })

  const searchMutation = useMutation({
    mutationFn: (q: string) => api.searchNews(q),
  })

  const value: NoticiasContextValue = {
    suggestions: data ?? [],
    isLoading,
    isError,
    query,
    setQuery,
    search: () => {
      const trimmed = query.trim()
      if (trimmed) searchMutation.mutate(trimmed)
    },
    searchResults: searchMutation.data ?? null,
    searching: searchMutation.isPending,
    searchError: searchMutation.isError,
  }

  return <NoticiasContext.Provider value={value}>{children}</NoticiasContext.Provider>
}

function useNoticias(): NoticiasContextValue {
  const ctx = useContext(NoticiasContext)
  if (!ctx) throw new Error('useNoticias deve ser usado dentro de NoticiasProvider')
  return ctx
}

// Rotação e tamanho determinísticos por recorte, a partir do id — mesmo recorte sempre
// cai no mesmo lugar do mosaico entre renders, sem embaralhar a cada re-render.
function hashSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

const SIZE_VARIANTS = [
  { span: 'col-span-2', imgH: '110px' },
  { span: 'col-span-1', imgH: '64px' },
  { span: 'col-span-1', imgH: '90px' },
] as const

function NewsThumb({ thumbnailUrl, sourceDomain, height }: { thumbnailUrl: string | null; sourceDomain: string; height: string }) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbnailUrl} alt="" className="w-full object-cover" style={{ height }} loading="lazy" />
    )
  }
  return (
    <div className="flex w-full items-center justify-center bg-[#e8dfc8]" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(sourceDomain)}&sz=64`}
        alt=""
        className="h-8 w-8 rounded-full bg-white/80 p-1"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

function Clipping({ suggestion, index }: { suggestion: ApiTopicSuggestion; index: number }) {
  const seed = hashSeed(suggestion.id)
  const rotate = (seed % 7) - 3 // -3deg a 3deg
  const variant = SIZE_VARIANTS[(seed + index) % SIZE_VARIANTS.length]!
  const tapeRotate = ((seed >> 3) % 5) - 2

  return (
    <div
      className={`relative bg-[#fdfaf3] ${variant.span}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        boxShadow: '0 3px 8px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15)',
        padding: '6px 6px 8px',
        clipPath:
          'polygon(0% 1%, 4% 0%, 22% 1.5%, 41% 0%, 63% 1%, 82% 0%, 100% 1.5%, 99% 22%, 100% 45%, 99% 68%, 100% 88%, 98% 100%, 76% 99%, 55% 100%, 33% 99%, 12% 100%, 1% 98%, 0% 76%, 1% 52%, 0% 28%)',
      }}
    >
      <div
        className="absolute h-3 w-8 opacity-60"
        style={{
          background: 'rgba(230,220,150,0.55)',
          top: '-6px',
          left: '50%',
          marginLeft: '-16px',
          transform: `rotate(${tapeRotate}deg)`,
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />

      <NewsThumb thumbnailUrl={suggestion.thumbnailUrl} sourceDomain={suggestion.sourceDomain} height={variant.imgH} />

      <p
        className="mt-1.5 line-clamp-2"
        style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '10.5px', lineHeight: 1.25, color: '#241d10' }}
      >
        {suggestion.headline}
      </p>

      <div className="mt-1 flex items-center justify-between gap-1">
        <a
          href={suggestion.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 truncate text-[8px] uppercase tracking-wide hover:underline"
          style={{ color: 'rgba(36,29,16,0.5)' }}
        >
          {suggestion.sourceDomain}
          <ExternalLink className="h-2 w-2 shrink-0" />
        </a>
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold"
          style={{ background: '#c9382a', color: '#fdfaf3' }}
          title="Aderência ao público"
        >
          {suggestion.audienceFitScore.toFixed(1)}
        </span>
      </div>

      <Link
        href={`/dashboard/generate?seed=${encodeURIComponent(suggestion.headline)}`}
        className="mt-1.5 inline-block rounded-sm px-2 py-1 text-[9px] font-bold"
        style={{ background: '#241d10', color: '#fdfaf3' }}
      >
        Criar post disso →
      </Link>
    </div>
  )
}

function ClippingGrid({ items }: { items: ApiTopicSuggestion[] }) {
  if (items.length === 0) {
    return <p className="text-xs italic" style={{ color: 'rgba(36,29,16,0.45)' }}>Nenhum recorte por aqui ainda.</p>
  }
  return (
    <div className="grid grid-cols-2 items-start gap-3 pb-2" style={{ gridAutoFlow: 'dense' }}>
      {items.map((s, i) => (
        <Clipping key={s.id} suggestion={s} index={i} />
      ))}
    </div>
  )
}

export function NoticiasDesktopLeft() {
  const { suggestions, isLoading, isError } = useNoticias()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Recortando notícias…
      </div>
    )
  }
  if (isError) {
    return <p className="text-xs" style={{ color: '#a34a2f' }}>Não foi possível buscar notícias agora.</p>
  }
  return <ClippingGrid items={suggestions} />
}

export function NoticiasDesktopRight() {
  const { query, setQuery, search, searchResults, searching, searchError } = useNoticias()

  return (
    <div className="flex flex-1 flex-col">
      <div
        className="mb-3 p-3"
        style={{ background: '#fdf6d8', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transform: 'rotate(-1deg)' }}
      >
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: '#5c4a1a' }}>
          <Newspaper className="h-3 w-3" /> Procurar outra pauta
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            search()
          }}
          className="flex gap-1.5"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex.: IA no varejo"
            className="flex-1 rounded border-none bg-white/70 px-2 py-1 text-[11px] outline-none"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="shrink-0 rounded px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
            style={{ background: '#5c4a1a' }}
          >
            Buscar
          </button>
        </form>
      </div>

      {searching ? (
        <p className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>Buscando…</p>
      ) : searchError ? (
        <p className="text-xs" style={{ color: '#a34a2f' }}>Não foi possível buscar agora.</p>
      ) : searchResults ? (
        <ClippingGrid items={searchResults} />
      ) : (
        <p className="text-xs italic" style={{ color: 'rgba(0,0,0,0.4)' }}>
          Busque um assunto para ver mais recortes aqui.
        </p>
      )}
    </div>
  )
}

const MOBILE_CHUNK = 4

export function NoticiasMobile() {
  const { suggestions, isLoading, query, setQuery, search, searchResults, searching } = useNoticias()
  const [pageIndex, setPageIndex] = useState(0)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Recortando notícias…
      </div>
    )
  }

  const pages: Array<{ kind: 'clippings'; items: ApiTopicSuggestion[] } | { kind: 'search' }> = []
  for (let i = 0; i < suggestions.length; i += MOBILE_CHUNK) {
    pages.push({ kind: 'clippings', items: suggestions.slice(i, i + MOBILE_CHUNK) })
  }
  pages.push({ kind: 'search' })

  const page = pages[Math.min(pageIndex, pages.length - 1)]

  return (
    <div className="flex flex-col gap-3">
      {page?.kind === 'clippings' && <ClippingGrid items={page.items} />}

      {page?.kind === 'search' && (
        <div>
          <div className="mb-3 p-3" style={{ background: '#fdf6d8', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transform: 'rotate(-1deg)' }}>
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: '#5c4a1a' }}>
              <Newspaper className="h-3 w-3" /> Procurar outra pauta
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                search()
              }}
              className="flex gap-1.5"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ex.: IA no varejo"
                className="flex-1 rounded border-none bg-white/70 px-2 py-1 text-[11px] outline-none"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="shrink-0 rounded px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                style={{ background: '#5c4a1a' }}
              >
                Buscar
              </button>
            </form>
          </div>
          {searching ? (
            <p className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>Buscando…</p>
          ) : searchResults ? (
            <ClippingGrid items={searchResults} />
          ) : (
            <p className="text-xs italic" style={{ color: 'rgba(0,0,0,0.4)' }}>Busque um assunto para ver recortes aqui.</p>
          )}
        </div>
      )}

      {pages.length > 1 && (
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
            {pageIndex + 1} / {pages.length}
          </span>
          <button
            disabled={pageIndex === pages.length - 1}
            onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
            className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
