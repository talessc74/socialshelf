'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'
import type { ApiCampaignItem } from '../../../../../lib/api'

function ItemThumbnail({
  url,
  editable,
  onRemove,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
}: {
  url: string | undefined
  editable: boolean
  onRemove: () => void
  canMoveLeft: boolean
  canMoveRight: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
}) {
  if (!url) {
    return <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-card-2" />
  }

  if (!editable) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
  }

  return (
    <div className="relative h-16 w-16 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover foto deste post"
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80"
      >
        ×
      </button>
      <div className="absolute bottom-0.5 left-0.5 right-0.5 flex justify-between">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          aria-label="Mover foto para trás (pode passar pro post anterior)"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80 disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={!canMoveRight}
          aria-label="Mover foto para frente (pode passar pro próximo post)"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80 disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  )
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

  // Uma única requisição pro lote inteiro de miniaturas em vez de uma por foto — ver
  // _local-edr-policy-039 pro rate limit global que uma requisição por miniatura esgota
  // sozinha numa campanha com muitas fotos.
  const photoPaths = (photos ?? []).map((p) => p.storagePath)
  const { data: imageUrls } = useQuery({
    queryKey: ['campaign-photo-urls', campaignId, photoPaths.join(',')],
    queryFn: () => api.getImageUrls(photoPaths),
    enabled: photoPaths.length > 0,
  })

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

  // Trata a linha do tempo inteira como uma única sequência de fotos atravessando os posts —
  // mover uma foto pra além da borda do post atual "vaza" pro post vizinho, cobrindo ao mesmo
  // tempo reordenar dentro de um carrossel e mover foto entre carrosséis com os mesmos dois
  // botões. Se o post de origem fica sem foto nenhuma, ele desaparece (carrossel virando uma
  // única foto é só o caso de sobrar 1). Só mexe no estado local — precisa "Salvar alterações".
  function movePhoto(itemIndex: number, photoIndex: number, direction: -1 | 1) {
    setItems((prev) => {
      if (!prev) return prev
      const current = prev[itemIndex]
      if (!current) return prev
      const targetPhotoIndex = photoIndex + direction

      if (targetPhotoIndex >= 0 && targetPhotoIndex < current.photoIds.length) {
        const photoIds = [...current.photoIds]
        ;[photoIds[photoIndex], photoIds[targetPhotoIndex]] = [photoIds[targetPhotoIndex]!, photoIds[photoIndex]!]
        return prev.map((item, i) => (i === itemIndex ? { ...item, photoIds } : item))
      }

      const targetItemIndex = itemIndex + direction
      if (targetItemIndex < 0 || targetItemIndex >= prev.length) return prev
      const photoId = current.photoIds[photoIndex]!
      const remainingPhotoIds = current.photoIds.filter((id) => id !== photoId)
      const targetItem = prev[targetItemIndex]!
      const targetPhotoIds = direction === 1 ? [photoId, ...targetItem.photoIds] : [...targetItem.photoIds, photoId]

      return prev
        .map((item, i) => {
          if (i === itemIndex) return { ...item, photoIds: remainingPhotoIds }
          if (i === targetItemIndex) return { ...item, photoIds: targetPhotoIds }
          return item
        })
        .filter((item) => item.photoIds.length > 0)
    })
  }

  function removePhoto(itemIndex: number, photoId: string) {
    setItems((prev) => {
      if (!prev) return prev
      return prev
        .map((item, i) => (i === itemIndex ? { ...item, photoIds: item.photoIds.filter((id) => id !== photoId) } : item))
        .filter((item) => item.photoIds.length > 0)
    })
  }

  const isReviewing = campaign?.status === 'reviewing'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{campaign?.name ?? 'Campanha'}</h1>
        <p className="text-sm text-muted">
          Confira a linha do tempo sugerida. Edite a legenda, reordene ou remova fotos de um post (as setas movem a
          foto pro post vizinho quando chegam na borda) — depois salve as alterações antes de ativar a campanha.
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
          {items.map((item, itemIndex) => (
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
                {item.photoIds.map((photoId, photoIndex) => {
                  const photo = photosById.get(photoId)
                  if (!photo) return null
                  return (
                    <ItemThumbnail
                      key={photoId}
                      url={imageUrls?.[photo.storagePath]}
                      editable={isReviewing}
                      onRemove={() => removePhoto(itemIndex, photoId)}
                      canMoveLeft={!(itemIndex === 0 && photoIndex === 0)}
                      canMoveRight={!(itemIndex === items.length - 1 && photoIndex === item.photoIds.length - 1)}
                      onMoveLeft={() => movePhoto(itemIndex, photoIndex, -1)}
                      onMoveRight={() => movePhoto(itemIndex, photoIndex, 1)}
                    />
                  )
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
