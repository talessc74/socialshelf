'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiPerformanceSuggestion, type ApiPost } from '../../../lib/api'

// Junta os dois lugares onde hoje dá pra "adiar uma decisão" no SocialShelf: sugestões
// guardadas na prateleira em Insights e rascunhos guardados para depois em Agendados. Não
// duplica a edição completa de nenhum dos dois — só reúne o que existe, com um atalho pra
// tela de origem quando a ação precisa de mais do que aprovar/descartar/remover.
function PostThumbnail({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading || !url) {
    return <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-card-2" />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
  )
}

function SavedSuggestionCard({ suggestion }: { suggestion: ApiPerformanceSuggestion }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const unshelveMutation = useMutation({
    mutationFn: () => api.setPerformanceSuggestionShelved(suggestion.id, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelved-performance-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['performance-suggestions'] })
    },
  })

  return (
    <li className="space-y-2 rounded-2xl border border-line bg-card p-4 shadow-card">
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
        💡 Sugestão de Insights
      </span>
      <p className="text-sm font-medium text-ink">{suggestion.headline}</p>
      <p className="text-xs text-muted">{suggestion.rationale}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => router.push(`/dashboard/generate?seed=${encodeURIComponent(suggestion.headline)}`)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
        >
          Criar post disso
        </button>
        <button
          onClick={() => unshelveMutation.mutate()}
          disabled={unshelveMutation.isPending}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2 disabled:opacity-40"
        >
          Remover da prateleira
        </button>
      </div>
    </li>
  )
}

function SavedPostCard({ post }: { post: ApiPost }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const firstImage = post.imageStoragePaths[0]

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['posts', 'saved-for-later'] })
    queryClient.invalidateQueries({ queryKey: ['posts', 'ai-draft'] })
  }

  const publishMutation = useMutation({
    mutationFn: () => api.publishPost(post.id),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.deletePost(post.id),
    onSuccess: invalidate,
  })
  const unsaveMutation = useMutation({
    mutationFn: () => api.setPostSavedForLater(post.id, false),
    onSuccess: invalidate,
  })

  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
      {firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1 space-y-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          🤖 Rascunho de Agendados
        </span>
        <p className="truncate text-sm font-medium text-ink">{post.content[0]?.text}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            {publishMutation.isPending ? 'Publicando…' : 'Aprovar e publicar agora'}
          </button>
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja descartar este rascunho? Ele não será publicado.')) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {deleteMutation.isPending ? 'Descartando…' : 'Descartar'}
          </button>
          <button
            onClick={() => unsaveMutation.mutate()}
            disabled={unsaveMutation.isPending}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2 disabled:opacity-40"
          >
            Remover dos guardados
          </button>
          <button
            onClick={() => router.push('/dashboard/scheduled')}
            className="text-xs font-medium text-accent hover:underline"
          >
            Editar em Agendados →
          </button>
        </div>
      </div>
    </li>
  )
}

export default function SavedForLaterPage() {
  const router = useRouter()

  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['shelved-performance-suggestions'],
    queryFn: () => api.getShelvedPerformanceSuggestions(),
  })
  const { data: posts, isLoading: loadingPosts } = useQuery({
    queryKey: ['posts', 'saved-for-later'],
    queryFn: () => api.getSavedForLaterPosts(),
  })

  const isLoading = loadingSuggestions || loadingPosts
  const isEmpty = !isLoading && (suggestions?.length ?? 0) === 0 && (posts?.length ?? 0) === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Guardados Para Depois</h1>
      </div>

      <p className="text-sm text-muted">
        Tudo que você deixou de lado pra decidir com calma — sugestões guardadas na prateleira em{' '}
        <Link href="/dashboard/insights" className="font-medium text-accent hover:underline">
          Insights
        </Link>{' '}
        e rascunhos guardados em{' '}
        <Link href="/dashboard/scheduled" className="font-medium text-accent hover:underline">
          Agendados
        </Link>
        .
      </p>

      {isLoading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : isEmpty ? (
        <p className="text-sm text-muted">
          Nada guardado ainda. Guarde uma sugestão em Insights ou um rascunho aguardando aprovação em Agendados
          pra revisitar aqui depois.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts?.map((post) => <SavedPostCard key={post.id} post={post} />)}
          {suggestions?.map((suggestion) => <SavedSuggestionCard key={suggestion.id} suggestion={suggestion} />)}
        </div>
      )}
    </div>
  )
}
