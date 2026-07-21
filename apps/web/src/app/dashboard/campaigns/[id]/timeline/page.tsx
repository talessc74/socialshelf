'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'
import type { ApiCampaignItem, ApiCampaignPhoto } from '../../../../../lib/api'
import { buildCampaignSummary } from '../../../../../lib/selfieCampaignSummary'
import { useSelfieNarrateOnReady } from '../../../../../contexts/AssistantContext'

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
  const queryClient = useQueryClient()

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
  useSelfieNarrateOnReady(items ? buildCampaignSummary(items) : null)

  const photosById = new Map((photos ?? []).map((p) => [p.id, p]))

  // Extras: fotos deixadas de fora do carrossel por serem quase-iguais a uma mantida, agrupadas
  // sob o id da foto representante. Pool só de visualização — nada é descartado.
  const extrasByRepresentative = new Map<string, ApiCampaignPhoto[]>()
  for (const photo of photos ?? []) {
    if (photo.duplicateOfPhotoId === null) continue
    const list = extrasByRepresentative.get(photo.duplicateOfPhotoId) ?? []
    list.push(photo)
    extrasByRepresentative.set(photo.duplicateOfPhotoId, list)
  }
  const hasExtras = extrasByRepresentative.size > 0

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

  const cancelCampaign = useMutation({
    mutationFn: () => api.cancelCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      router.push('/dashboard/campaigns')
    },
  })

  const pauseCampaign = useMutation({
    mutationFn: () => api.pauseCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-timeline', campaignId] })
    },
  })

  const resumeCampaign = useMutation({
    mutationFn: () => api.resumeCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
      // Resume reagenda os itens pendentes pra datas novas — a linha do tempo em cache mostraria
      // os horários antigos até o refetch.
      queryClient.invalidateQueries({ queryKey: ['campaign-timeline', campaignId] })
    },
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
  const isPausable = campaign?.status === 'active'
  const isResumable = campaign?.status === 'paused'
  // Mesma regra do CancelCampaignUseCase no backend: só completed/cancelled ficam de fora.
  const isCancellable = !!campaign && campaign.status !== 'completed' && campaign.status !== 'cancelled'

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

      {hasExtras && (
        <section className="rounded-2xl border border-line bg-card-2 p-4">
          <h2 className="text-sm font-semibold text-ink">Fotos quase iguais deixadas de fora</h2>
          <p className="mt-1 text-xs text-muted">
            Para o carrossel não ficar repetitivo, mantivemos uma foto de cada grupo de imagens muito parecidas e
            deixamos as demais de fora. Nenhuma foto foi apagada — elas continuam aqui.
          </p>
          <ul className="mt-3 space-y-3">
            {[...extrasByRepresentative.entries()].map(([representativeId, extras]) => {
              const representative = photosById.get(representativeId)
              return (
                <li key={representativeId} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    {representative && imageUrls?.[representative.storagePath] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrls[representative.storagePath]}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover ring-2 ring-accent"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-card-2 ring-2 ring-accent" />
                    )}
                    <span className="text-[10px] font-semibold text-accent">no carrossel</span>
                  </div>
                  <span className="text-muted">→</span>
                  <div className="flex flex-1 gap-2 overflow-x-auto">
                    {extras.map((extra) => (
                      <div key={extra.id} className="flex flex-col items-center gap-1">
                        {imageUrls?.[extra.storagePath] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrls[extra.storagePath]}
                            alt=""
                            className="h-14 w-14 shrink-0 rounded-lg object-cover opacity-70"
                          />
                        ) : (
                          <div className="h-14 w-14 shrink-0 rounded-lg bg-card-2" />
                        )}
                        <span className="text-[10px] text-muted">de fora</span>
                      </div>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {(saveTimeline.isError || activateCampaign.isError || cancelCampaign.isError || pauseCampaign.isError || resumeCampaign.isError) && (
        <p className="text-sm text-red-600">
          {
            (
              (activateCampaign.error ??
                saveTimeline.error ??
                cancelCampaign.error ??
                pauseCampaign.error ??
                resumeCampaign.error) as Error
            ).message
          }
        </p>
      )}

      {(isReviewing || isCancellable || isPausable || isResumable) && (
        <div className="flex flex-wrap gap-2">
          {isReviewing && (
            <>
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
            </>
          )}
          {isPausable && (
            <button
              type="button"
              onClick={() => pauseCampaign.mutate()}
              disabled={pauseCampaign.isPending}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card-2 disabled:opacity-40"
            >
              {pauseCampaign.isPending ? 'Pausando…' : 'Pausar campanha'}
            </button>
          )}
          {isResumable && (
            <button
              type="button"
              onClick={() => resumeCampaign.mutate()}
              disabled={resumeCampaign.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
            >
              {resumeCampaign.isPending ? 'Retomando…' : 'Retomar campanha'}
            </button>
          )}
          {isCancellable && (
            <button
              type="button"
              onClick={() => {
                const activeWarning =
                  campaign?.status === 'active' || campaign?.status === 'paused'
                    ? ' Posts ainda não publicados serão apagados; os já publicados continuam no histórico.'
                    : ''
                if (
                  confirm(
                    `Tem certeza que deseja cancelar a campanha "${campaign?.name}"?${activeWarning} Essa ação não pode ser desfeita.`,
                  )
                ) {
                  cancelCampaign.mutate()
                }
              }}
              disabled={cancelCampaign.isPending}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {cancelCampaign.isPending ? 'Cancelando…' : 'Cancelar campanha'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
