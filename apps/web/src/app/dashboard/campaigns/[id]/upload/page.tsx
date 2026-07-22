'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'
import type { ApiCampaignPhoto } from '../../../../../lib/api'

function UploadedPhotoThumbnail({
  url,
  deleting,
  dragging,
  onDelete,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  registerRef,
}: {
  url: string | undefined
  deleting: boolean
  dragging: boolean
  onDelete: () => void
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  registerRef: (el: HTMLDivElement | null) => void
}) {
  if (!url) {
    return <div className="aspect-square w-full animate-pulse rounded-lg bg-card-2" />
  }

  return (
    <div
      ref={registerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative touch-none select-none transition-transform ${dragging ? 'z-10 scale-105 opacity-70' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false} className="aspect-square w-full cursor-grab rounded-lg object-cover active:cursor-grabbing" />
      <button
        type="button"
        onClick={onDelete}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={deleting}
        aria-label="Remover foto"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80 disabled:opacity-50"
      >
        {deleting ? '…' : '×'}
      </button>
    </div>
  )
}

export default function CampaignUploadPage() {
  const params = useParams<{ id: string }>()
  const campaignId = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: campaign } = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.getCampaign(campaignId) })
  const {
    data: photos,
    error: photosError,
  } = useQuery({
    queryKey: ['campaign-photos', campaignId],
    queryFn: () => api.getCampaignPhotos(campaignId),
  })

  // Uma única requisição pro lote inteiro de miniaturas em vez de uma por foto — telas de
  // campanha podem ter centenas de fotos, e uma requisição por miniatura esgota sozinha o
  // rate limit global de 100/min do api-service (ver _local-edr-policy-039).
  const photoPaths = (photos ?? []).map((p) => p.storagePath)
  const { data: imageUrls } = useQuery({
    queryKey: ['campaign-photo-urls', campaignId, photoPaths.join(',')],
    queryFn: () => api.getImageUrls(photoPaths),
    enabled: photoPaths.length > 0,
  })

  const generateTimeline = useMutation({
    mutationFn: () => api.generateCampaignTimeline(campaignId),
    onSuccess: () => router.push(`/dashboard/campaigns/${campaignId}/timeline`),
  })

  // Campanha 'active' já publicando: gerar do zero apagaria itens já materializados em Post
  // real, então fotos novas entram por um caminho que só anexa (ver ExtendCampaignTimelineUseCase).
  const extendTimeline = useMutation({
    mutationFn: () => api.extendCampaignTimeline(campaignId),
    onSuccess: () => router.push(`/dashboard/campaigns/${campaignId}/timeline`),
  })
  const isActiveCampaign = campaign?.status === 'active'

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
    },
  })

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.deleteCampaignPhoto(campaignId, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] }),
  })

  const reorderPhotos = useMutation({
    mutationFn: (photoIds: string[]) => api.reorderCampaignPhotos(campaignId, photoIds),
    // Grava a nova ordem direto no cache em vez de só invalidar — invalidar faria a grade
    // "voltar" pra ordem antiga por um instante até o refetch chegar, desfazendo visualmente
    // o arraste que acabou de acontecer.
    onSuccess: (_data, photoIds) => {
      queryClient.setQueryData<ApiCampaignPhoto[]>(['campaign-photos', campaignId], (current) => {
        if (!current) return current
        const byId = new Map(current.map((p) => [p.id, p]))
        return photoIds.map((id) => byId.get(id)).filter((p): p is ApiCampaignPhoto => p !== undefined)
      })
    },
  })

  // Arraste com Pointer Events em vez de HTML5 drag-and-drop nativo (que não funciona direito
  // em touch sem polyfill) — um único conjunto de handlers cobre mouse e dedo. setPointerCapture
  // garante que o elemento arrastado continua recebendo move/up mesmo se o ponteiro sair da sua
  // área. A cada frame, a foto arrastada troca de posição com a miniatura mais próxima do
  // ponteiro; ao soltar, persiste a ordem final.
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<typeof photos>(undefined)
  const thumbnailRefs = useRef(new Map<string, HTMLDivElement>())
  const orderedPhotos = dragPreview ?? photos

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, photoId: string) {
    if (!orderedPhotos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraggedId(photoId)
    setDragPreview(orderedPhotos)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggedId || !dragPreview) return
    const draggedIndex = dragPreview.findIndex((p) => p.id === draggedId)
    if (draggedIndex === -1) return

    let closestIndex = draggedIndex
    let closestDistance = Infinity
    dragPreview.forEach((photo, index) => {
      const el = thumbnailRefs.current.get(photo.id)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const distance = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2))
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    })

    if (closestIndex !== draggedIndex) {
      const next = [...dragPreview]
      const [moved] = next.splice(draggedIndex, 1)
      next.splice(closestIndex, 0, moved!)
      setDragPreview(next)
    }
  }

  function handlePointerUp() {
    // Só persiste se a ordem de fato mudou — um toque/clique simples também passa por
    // pointerdown+pointerup na miniatura (não só um arraste real), e mandar a lista inteira de
    // volta sem necessidade eleva a chance de pegar uma foto excluída bem nesse instante (achado
    // real em produção: exclusão + reorder quase simultâneos derrubavam o backend).
    if (draggedId && dragPreview && photos) {
      const reordered = dragPreview.some((photo, index) => photo.id !== photos[index]?.id)
      if (reordered) reorderPhotos.mutate(dragPreview.map((p) => p.id))
    }
    setDraggedId(null)
    setDragPreview(undefined)
  }

  // Um arquivo por requisição, o cliente faz o loop — mesmo padrão já usado no upload de
  // imagem manual (compose/generate), já que o multipart do api-service aceita 1 arquivo por vez.
  // Cada foto é isolada em try/catch (mesmo padrão de AutonomyTickUseCase/GetPostsPerformanceUseCase):
  // uma falha no meio de um lote grande não pode impedir as demais de subir nem esconder da tela
  // as que já subiram — por isso a lista é atualizada a cada foto, não só no final, com sucesso ou não.
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    setUploading(true)
    setUploadError(null)
    setUploadProgress({ done: 0, total: fileArray.length })
    const failures: string[] = []
    for (const [index, file] of fileArray.entries()) {
      try {
        await api.uploadCampaignPhoto(campaignId, file)
        await queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] })
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : 'falha desconhecida'}`)
      }
      setUploadProgress({ done: index + 1, total: fileArray.length })
    }
    if (failures.length > 0) {
      const shown = failures.slice(0, 3).join('; ')
      const rest = failures.length > 3 ? ` (e mais ${failures.length - 3})` : ''
      setUploadError(`${failures.length} de ${files.length} foto(s) não subiram: ${shown}${rest}`)
    }
    setUploading(false)
    setUploadProgress(null)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{campaign?.name ?? 'Campanha'}</h1>
        <p className="text-sm text-muted">
          {isActiveCampaign
            ? 'Essa campanha já está ativa e publicando. As fotos novas entram na fila sem mexer no que já foi agendado ou publicado.'
            : 'Suba todas as fotos da campanha. Vamos agrupar por localidade (GPS) e sugerir carrosséis na próxima etapa.'}
        </p>
      </div>

      <label
        htmlFor="campaign-photos-input"
        onDragOver={(e) => {
          e.preventDefault()
          if (!uploading) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          if (uploading) return
          void handleFiles(e.dataTransfer.files)
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging ? 'border-accent bg-accent-soft' : 'border-line bg-card hover:border-accent'
        }`}
      >
        <span className="text-sm font-semibold text-ink">
          {uploading
            ? `Enviando fotos… (${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? 0})`
            : isDragging
              ? 'Solte as fotos aqui'
              : 'Clique ou arraste as fotos aqui'}
        </span>
        <span className="text-xs text-muted">JPEG, PNG ou WEBP — pode selecionar ou arrastar várias de uma vez</span>
        <input
          id="campaign-photos-input"
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
          className="hidden"
        />
      </label>

      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

      {photosError && (
        <p className="text-sm text-red-600">
          Não foi possível carregar as fotos já enviadas: {(photosError as Error).message}
        </p>
      )}

      {orderedPhotos && orderedPhotos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {orderedPhotos.length} foto{orderedPhotos.length > 1 ? 's' : ''} enviada
            {orderedPhotos.length > 1 ? 's' : ''} — arraste pra reordenar
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {orderedPhotos.map((photo) => (
              <UploadedPhotoThumbnail
                key={photo.id}
                url={imageUrls?.[photo.storagePath]}
                deleting={deletePhoto.isPending && deletePhoto.variables === photo.id}
                dragging={draggedId === photo.id}
                onDelete={() => {
                  if (confirm('Remover esta foto da campanha?')) deletePhoto.mutate(photo.id)
                }}
                onPointerDown={(e) => handlePointerDown(e, photo.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                registerRef={(el) => {
                  if (el) thumbnailRefs.current.set(photo.id, el)
                  else thumbnailRefs.current.delete(photo.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {deletePhoto.isError && <p className="text-sm text-red-600">{(deletePhoto.error as Error).message}</p>}

      {reorderPhotos.isError && <p className="text-sm text-red-600">{(reorderPhotos.error as Error).message}</p>}

      {generateTimeline.isError && (
        <p className="text-sm text-red-600">{(generateTimeline.error as Error).message}</p>
      )}

      {extendTimeline.isError && (
        <p className="text-sm text-red-600">{(extendTimeline.error as Error).message}</p>
      )}

      {cancelCampaign.isError && (
        <p className="text-sm text-red-600">{(cancelCampaign.error as Error).message}</p>
      )}

      {pauseCampaign.isError && <p className="text-sm text-red-600">{(pauseCampaign.error as Error).message}</p>}

      <div className="flex flex-wrap gap-2">
        {isActiveCampaign ? (
          <button
            type="button"
            onClick={() => extendTimeline.mutate()}
            disabled={!photos || photos.length === 0 || extendTimeline.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            {extendTimeline.isPending ? 'Agendando fotos novas…' : 'Agendar fotos novas'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => generateTimeline.mutate()}
            disabled={!photos || photos.length === 0 || generateTimeline.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            {generateTimeline.isPending ? 'Gerando linha do tempo…' : 'Gerar linha do tempo'}
          </button>
        )}
        {isActiveCampaign && (
          <button
            type="button"
            onClick={() => pauseCampaign.mutate()}
            disabled={pauseCampaign.isPending}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-card-2 disabled:opacity-40"
          >
            {pauseCampaign.isPending ? 'Pausando…' : 'Pausar campanha'}
          </button>
        )}
        {campaign?.status !== 'completed' && campaign?.status !== 'cancelled' && (
          <button
            type="button"
            onClick={() => {
              const activeWarning = isActiveCampaign
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
    </div>
  )
}
