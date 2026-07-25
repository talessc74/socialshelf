'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark } from 'lucide-react'
import { api, type ApiPerformanceSuggestion, type ApiPost } from '../lib/api'

// Mesma faixa horizontal do NewsCarousel (Notícias para pauta), aplicada ao mesmo conteúdo
// de /dashboard/saved-for-later — dá pra ver na Home, sem clicar em nada, os posts prontos
// pra publicação que ficaram guardados, não só um atalho estático.
function PostThumbnail({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading || !url) {
    return <div className="h-32 w-full animate-pulse bg-card-2" />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-32 w-full object-cover" />
  )
}

function SavedPostCarouselCard({ post }: { post: ApiPost }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const firstImage = post.imageStoragePaths[0]

  const publishMutation = useMutation({
    mutationFn: () => api.publishPost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'saved-for-later'] })
      queryClient.invalidateQueries({ queryKey: ['posts', 'ai-draft'] })
    },
  })

  return (
    <article className="flex w-[80%] max-w-xs shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-line bg-card sm:w-72">
      {firstImage ? (
        <PostThumbnail path={firstImage} />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-accent">
          <Bookmark className="h-8 w-8 text-accent-ink/80" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          🤖 Pronto pra publicar
        </span>
        <p className="line-clamp-2 text-sm font-medium text-ink">{post.content[0]?.text}</p>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            {publishMutation.isPending ? 'Publicando…' : 'Aprovar e publicar'}
          </button>
          <button
            onClick={() => router.push('/dashboard/scheduled')}
            className="shrink-0 text-xs font-medium text-accent hover:underline"
          >
            Ver em Agendados
          </button>
        </div>
      </div>
    </article>
  )
}

function SavedSuggestionCarouselCard({ suggestion }: { suggestion: ApiPerformanceSuggestion }) {
  const router = useRouter()

  return (
    <article className="flex w-[80%] max-w-xs shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-line bg-card sm:w-72">
      <div className="flex h-32 w-full items-center justify-center bg-accent-soft">
        <Bookmark className="h-8 w-8 text-accent/80" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
          💡 Sugestão guardada
        </span>
        <p className="line-clamp-2 text-sm font-medium text-ink">{suggestion.headline}</p>
        <p className="line-clamp-2 text-xs text-muted">{suggestion.rationale}</p>
        <div className="mt-auto pt-1">
          <button
            onClick={() => router.push(`/dashboard/generate?seed=${encodeURIComponent(suggestion.headline)}`)}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
          >
            Criar post disso
          </button>
        </div>
      </div>
    </article>
  )
}

export function SavedForLaterCarousel() {
  const {
    data: posts,
    isLoading: loadingPosts,
    isError: postsError,
  } = useQuery({
    queryKey: ['posts', 'saved-for-later'],
    queryFn: () => api.getSavedForLaterPosts(),
  })

  const {
    data: suggestions,
    isLoading: loadingSuggestions,
    isError: suggestionsError,
  } = useQuery({
    queryKey: ['shelved-performance-suggestions'],
    queryFn: () => api.getShelvedPerformanceSuggestions(),
  })

  const isLoading = loadingPosts || loadingSuggestions
  const isError = postsError || suggestionsError
  const isEmpty = !isLoading && !isError && (posts?.length ?? 0) === 0 && (suggestions?.length ?? 0) === 0

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-semibold text-ink">
          <Bookmark className="h-4 w-4 text-accent" /> Guardados Para Depois
        </p>
        <Link href="/dashboard/saved-for-later" className="text-xs font-semibold text-accent hover:underline">
          Ver todos
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted-2">
        Rascunhos prontos pra publicação e sugestões que você deixou de lado pra decidir com calma.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-2">Carregando o que você guardou…</p>
      ) : isError ? (
        <p className="text-sm text-amber-600">Não foi possível carregar os guardados agora. Tente recarregar em instantes.</p>
      ) : isEmpty ? (
        <p className="text-sm text-muted">
          Nada guardado ainda. Guarde um rascunho em Agendados ou uma sugestão em Insights pra revisitar aqui.
        </p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
          {posts?.map((post) => <SavedPostCarouselCard key={post.id} post={post} />)}
          {suggestions?.map((suggestion) => (
            <SavedSuggestionCarouselCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      )}
    </section>
  )
}
