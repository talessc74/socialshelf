'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'
import type { ApiCampaignItem } from '../../../../../lib/api'

function ItemThumbnail({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({ queryKey: ['image-url', path], queryFn: () => api.getImageUrl(path) })

  if (isLoading || !url) {
    return <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-card-2" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
}

export default function CampaignTimelinePage() {
  const params = useParams<{ id: string }>()
  const campaignId = params.id
  const router = useRouter()

  const { data: campaign } = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.getCampaign(campaignId) })
  const { data: photos, error: photosError } = useQuery({
    queryKey: ['campaign-photos', campaignId],
    queryFn: () => api.getCampaignPhotos(campaignId),
  })
  const { data: serverItems, error: timelineError } = useQuery({
    queryKey: ['campaign-timeline', campaignId],
    queryFn: () => api.getCampaignTimeline(campaignId),
  })

  const [items, setItems] = useState<ApiCampaignItem[] | null>(null)
  useEffect(() => {
    if (serverItems) setItems(serverItems)
  }, [serverItems])

  const photosById = new Map((photos ?? []).map((p) => [p.id, p]))

  const saveTimeline = useMutation({
    mutationFn: () =>
      api.updateCampaignTimeline(
        campaignId,
        (items ?? []).map((item) => ({
          id: item.id,
          order: item.order,
          photoIds: item.photoIds,
          caption: item.caption,
          scheduledAt: item.scheduledAt,
        })),
      ),
  })

  const activateCampaign = useMutation({
    mutationFn: async () => {
      await saveTimeline.mutateAsync()
      return api.activateCampaign(campaignId)
    },
    onSuccess: () => router.push('/dashboard/campaigns'),
  })

  function updateCaption(itemId: string, caption: string) {
    setItems((prev) => prev?.map((item) => (item.id === itemId ? { ...item, caption } : item)) ?? null)
  }

  const isReviewing = campaign?.status === 'reviewing'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{campaign?.name ?? 'Campanha'}</h1>
        <p className="text-sm text-muted">
          Confira a linha do tempo sugerida. Edite a legenda de qualquer item antes de ativar a campanha.
        </p>
      </div>

      {(photosError || timelineError) && (
        <p className="text-sm text-red-600">
          Não foi possível carregar a linha do tempo: {((timelineError ?? photosError) as Error).message}
        </p>
      )}

      {!items || items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
          Nenhum item na linha do tempo ainda.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line bg-card p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                  {new Date(item.scheduledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="text-xs text-muted">
                  {item.photoIds.length > 1 ? `Carrossel · ${item.photoIds.length} fotos` : '1 foto'}
                </span>
              </div>
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {item.photoIds.map((photoId) => {
                  const photo = photosById.get(photoId)
                  return photo ? <ItemThumbnail key={photoId} path={photo.storagePath} /> : null
                })}
              </div>
              <textarea
                value={item.caption}
                onChange={(e) => updateCaption(item.id, e.target.value)}
                disabled={!isReviewing}
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink disabled:opacity-60"
              />
            </li>
          ))}
        </ul>
      )}

      {(saveTimeline.isError || activateCampaign.isError) && (
        <p className="text-sm text-red-600">
          {((activateCampaign.error ?? saveTimeline.error) as Error).message}
        </p>
      )}

      {isReviewing && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => saveTimeline.mutate()}
            disabled={saveTimeline.isPending || !items}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card-2 disabled:opacity-40"
          >
            {saveTimeline.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            onClick={() => activateCampaign.mutate()}
            disabled={activateCampaign.isPending || !items || items.length === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            {activateCampaign.isPending ? 'Ativando…' : 'Ativar campanha'}
          </button>
        </div>
      )}
    </div>
  )
}
