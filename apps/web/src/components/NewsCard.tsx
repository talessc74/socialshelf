'use client'

import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import type { ApiTopicSuggestion } from '../lib/api'
import { ScoreBadge } from './ScoreBadge'

export function NewsCard({ suggestion: s }: { suggestion: ApiTopicSuggestion }) {
  return (
    <article className="flex w-[80%] max-w-xs shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gray-100 sm:w-72">
      <NewsThumbnail thumbnailUrl={s.thumbnailUrl} sourceDomain={s.sourceDomain} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs font-medium text-gray-400">{s.sourceDomain}</span>
        <p className="line-clamp-2 text-sm font-medium text-gray-800">{s.headline}</p>
        <p className="line-clamp-2 text-xs text-gray-500">{s.summary}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <ScoreBadge label="Aderência" score={s.audienceFitScore} />
          <Link
            href={`/dashboard/generate?seed=${encodeURIComponent(s.headline)}`}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Criar post disso
          </Link>
        </div>
      </div>
    </article>
  )
}

function NewsThumbnail({ thumbnailUrl, sourceDomain }: { thumbnailUrl: string | null; sourceDomain: string }) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagens vêm de domínios de notícia arbitrários (og:image), inviável allowlistar no next/image
      <img
        src={thumbnailUrl}
        alt={`Imagem da notícia de ${sourceDomain}`}
        className="h-32 w-full bg-gray-100 object-cover"
        loading="lazy"
      />
    )
  }
  // Fallback quando o veículo não expõe og:image: bloco visual da marca em vez de quadro quebrado.
  return (
    <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700">
      <Newspaper className="h-8 w-8 text-white/80" />
    </div>
  )
}
