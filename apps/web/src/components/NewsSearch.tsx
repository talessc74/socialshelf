'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { NewsCard } from './NewsCard'

export function NewsSearch() {
  const [query, setQuery] = useState('')

  const searchMutation = useMutation({
    mutationFn: (q: string) => api.searchNews(q),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    searchMutation.mutate(trimmed)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-900">
        <Search className="h-4 w-4 text-brand-600" /> Buscar uma notícia
      </p>
      <p className="mb-4 text-xs text-gray-400">
        Já viu uma notícia relevante? Busque pelo assunto e crie um post direto a partir dela.
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: inteligência artificial no varejo"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={searchMutation.isPending || !query.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          Buscar
        </button>
      </form>

      {searchMutation.isPending ? (
        <p className="text-sm text-gray-400">Buscando notícias…</p>
      ) : searchMutation.isError ? (
        <p className="text-sm text-amber-600">
          Não foi possível buscar agora. Tente novamente.
          {searchMutation.error instanceof Error && (
            <span className="mt-1 block text-xs text-gray-400">{searchMutation.error.message}</span>
          )}
        </p>
      ) : searchMutation.isSuccess && searchMutation.data.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma notícia verificada encontrada para esse assunto. Tente outros termos.
        </p>
      ) : searchMutation.isSuccess ? (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
          {searchMutation.data.map((s) => (
            <NewsCard key={s.id} suggestion={s} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
