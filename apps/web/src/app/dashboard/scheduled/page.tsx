'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'
import type { ApiPost } from '../../../lib/api'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
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

function PostCard({ post }: { post: ApiPost }) {
  const firstImage = post.imageStoragePaths[0]

  return (
    <li className="flex gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
      {firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
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
        <p className="truncate text-sm text-gray-800">{post.content[0]?.text}</p>
      </div>
    </li>
  )
}

export default function ScheduledPostsPage() {
  const router = useRouter()

  const { data, isLoading, error } = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => api.getPosts('scheduled'),
  })

  const posts = data ?? []

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
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum post agendado ainda. Gere ou componha um post e escolha uma data para publicação.
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </ul>
      )}
    </div>
  )
}
