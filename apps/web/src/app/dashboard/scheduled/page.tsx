'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform, PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type { ApiPost, PostContent } from '../../../lib/api'

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
  const queryClient = useQueryClient()
  const firstImage = post.imageStoragePaths[0]

  const [isEditing, setIsEditing] = useState(false)
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>(
    Object.fromEntries(post.content.map((c) => [c.platform, c.text])),
  )
  const [images, setImages] = useState<string[]>(post.imageStoragePaths)
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([])
  const [scheduledAtInput, setScheduledAtInput] = useState(toDatetimeLocalValue(post.scheduledAt))

  const updateMutation = useMutation({
    mutationFn: async (input: {
      content: PostContent[]
      images: string[]
      newPhotoFiles: File[]
      scheduledAt: Date
    }) => {
      const uploadedPaths =
        input.newPhotoFiles.length > 0
          ? await Promise.all(input.newPhotoFiles.map((f) => api.uploadImage(f)))
          : []
      const imageStoragePaths = [...input.images, ...uploadedPaths]
      return api.updatePost(post.id, input.content, imageStoragePaths, input.scheduledAt)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
      setNewPhotoFiles([])
      setIsEditing(false)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => api.publishPost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', 'scheduled'] })
    },
  })

  const scheduledDate = scheduledAtInput ? new Date(scheduledAtInput) : null
  const scheduledAtValid =
    scheduledDate !== null && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()

  const canSave =
    scheduledAtValid &&
    post.content.every((c) => {
      const t = texts[c.platform] ?? ''
      return t.trim().length > 0 && t.length <= PLATFORM_CHARACTER_LIMITS[c.platform]
    })

  const handleCancel = () => {
    setTexts(Object.fromEntries(post.content.map((c) => [c.platform, c.text])))
    setImages(post.imageStoragePaths)
    setNewPhotoFiles([])
    setScheduledAtInput(toDatetimeLocalValue(post.scheduledAt))
    setIsEditing(false)
  }

  const handleSave = () => {
    if (!canSave || !scheduledDate) return
    const content = post.content.map((c) => ({ platform: c.platform, text: texts[c.platform] ?? '' }))
    updateMutation.mutate({ content, images, newPhotoFiles, scheduledAt: scheduledDate })
  }

  return (
    <li className="flex gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
      {!isEditing && firstImage && <PostThumbnail path={firstImage} />}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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

        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-3">
              {post.content.map((c) => {
                const text = texts[c.platform] ?? ''
                const limit = PLATFORM_CHARACTER_LIMITS[c.platform]
                return (
                  <div key={c.platform}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">{PLATFORM_LABELS[c.platform]}</span>
                      <span
                        className={`text-xs tabular-nums ${
                          text.length > limit ? 'font-bold text-red-600' : 'text-gray-400'
                        }`}
                      >
                        {limit - text.length}
                      </span>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => setTexts((prev) => ({ ...prev, [c.platform]: e.target.value }))}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-gray-200 p-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                )
              })}
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-gray-500">Fotos</span>
              {images.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {images.map((path) => (
                    <li key={path} className="relative">
                      <PostThumbnail path={path} />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((p) => p !== path))}
                        aria-label="Remover foto"
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white hover:bg-red-600"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {newPhotoFiles.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {newPhotoFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-600"
                    >
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setNewPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="ml-2 shrink-0 text-red-500 hover:text-red-700"
                      >
                        Remover
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
                className="block w-full text-xs text-gray-600"
              />
            </div>

            <div>
              <label htmlFor={`scheduledAt-${post.id}`} className="mb-1.5 block text-xs font-medium text-gray-500">
                Data de publicação
              </label>
              <input
                id={`scheduledAt-${post.id}`}
                type="datetime-local"
                value={scheduledAtInput}
                onChange={(e) => setScheduledAtInput(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              {scheduledAtInput && !scheduledAtValid && (
                <p className="mt-1 text-xs text-red-600">A data de publicação deve ser no futuro.</p>
              )}
            </div>

            {updateMutation.isError && (
              <p className="text-xs text-red-600">
                {updateMutation.error instanceof Error ? updateMutation.error.message : 'Erro ao salvar.'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!canSave || updateMutation.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {updateMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="truncate text-sm text-gray-800">{post.content[0]?.text}</p>
            {publishMutation.isError && (
              <p className="text-xs text-red-600">
                {publishMutation.error instanceof Error ? publishMutation.error.message : 'Erro ao publicar.'}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
              >
                {publishMutation.isPending ? 'Publicando…' : 'Publicar agora'}
              </button>
            </div>
          </>
        )}
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
