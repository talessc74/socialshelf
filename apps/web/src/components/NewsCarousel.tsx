'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import { api } from '../lib/api'
import { ScoreBadge } from './ScoreBadge'

export function NewsCarousel() {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: () => api.getTopicSuggestions(),
  })

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-4 flex items-center gap-1.5 font-semibold text-gray-900">
        <Newspaper className="h-4 w-4 text-brand-600" /> Notícias para pauta
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-400">Buscando notícias relevantes para sua marca…</p>
      ) : !suggestions || suggestions.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma notícia disponível ainda. A IA verifica fontes confiáveis e avisa aqui quando encontrar algo
          relevante para sua marca.
        </p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex w-[80%] max-w-xs shrink-0 snap-start flex-col gap-2 rounded-xl border border-gray-100 p-4 sm:w-72"
            >
              <span className="text-xs font-medium text-gray-400">{s.sourceDomain}</span>
              <p className="line-clamp-2 text-sm font-medium text-gray-800">{s.headline}</p>
              <p className="line-clamp-2 text-xs text-gray-500">{s.summary}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <ScoreBadge label="Aderência" score={s.audienceFitScore} />
                <Link
                  href={`/dashboard/generate?seed=${encodeURIComponent(s.headline)}`}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Criar post disso
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
