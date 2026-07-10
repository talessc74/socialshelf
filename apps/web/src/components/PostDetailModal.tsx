'use client'

import { useQuery } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import { api, type ApiPost } from '../lib/api'
import { externalPostUrl } from '../lib/externalPostUrl'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
}

function DetailImage({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({ queryKey: ['image-url', path], queryFn: () => api.getImageUrl(path) })

  if (isLoading || !url) {
    return <div className="aspect-square w-full animate-pulse rounded-lg bg-card-2" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
}

function DetailVideo({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({ queryKey: ['generated-video-url', path], queryFn: () => api.getVideoUrl(path) })

  if (isLoading || !url) {
    return <div className="aspect-[9/16] w-full max-w-xs animate-pulse rounded-lg bg-card-2" />
  }

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video src={url} controls className="aspect-[9/16] w-full max-w-xs rounded-lg bg-black" />
}

// Mostra o post exatamente como foi enviado — texto completo por plataforma (não truncado),
// todas as imagens, vídeo quando houver, e link pra abrir o post real na rede quando dá pra
// construir esse link só a partir do externalId já salvo (ver externalPostUrl.ts).
export function PostDetailModal({ post, onClose }: { post: ApiPost; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Post completo"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Post completo</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-card-2 px-3 py-1 text-xs text-muted hover:bg-line"
          >
            Fechar ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {post.status === 'published' && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              ✓ Publicado
              {post.publishedAt
                ? ` em ${new Date(post.publishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                : ''}
            </span>
          )}
          {post.origin === 'autonomy-tick' && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              🤖 Automático
            </span>
          )}
        </div>

        {post.imageStoragePaths.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {post.imageStoragePaths.map((path) => (
              <DetailImage key={path} path={path} />
            ))}
          </div>
        )}

        {post.videoStoragePath && (
          <div className="mb-4">
            <DetailVideo path={post.videoStoragePath} />
          </div>
        )}

        <div className="space-y-3">
          {post.content.map((c) => {
            const externalId = post.externalIds[c.platform]
            const link = externalId ? externalPostUrl(c.platform, externalId) : null
            return (
              <div key={c.platform} className="rounded-xl border border-line bg-card-2 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">{PLATFORM_LABELS[c.platform]}</span>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Ver no {PLATFORM_LABELS[c.platform]} ↗
                    </a>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{c.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
