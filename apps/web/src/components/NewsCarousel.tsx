'use client'

import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import { api } from '../lib/api'
import { NewsCard } from './NewsCard'

export function NewsCarousel() {
  const {
    data: suggestions,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: () => api.getTopicSuggestions(),
  })

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-gray-900">
        <Newspaper className="h-4 w-4 text-brand-600" /> Notícias para pauta
      </p>
      <p className="mb-4 text-xs text-gray-400">
        Fontes internacionais verificadas, traduzidas automaticamente para o português.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-400">Buscando notícias relevantes para sua marca…</p>
      ) : isError ? (
        <p className="text-sm text-amber-600">
          Não foi possível buscar as notícias agora. Tente recarregar em instantes.
          {error instanceof Error && <span className="mt-1 block text-xs text-gray-400">{error.message}</span>}
        </p>
      ) : !suggestions || suggestions.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma notícia disponível ainda. A IA verifica fontes confiáveis e avisa aqui quando encontrar algo
          relevante para sua marca.
        </p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <NewsCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </section>
  )
}
