'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'

function UploadedPhotoThumbnail({
  url,
  deleting,
  onDelete,
  moving,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
}: {
  url: string | undefined
  deleting: boolean
  onDelete: () => void
  moving: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
}) {
  if (!url) {
    return <div className="aspect-square w-full animate-pulse rounded-lg bg-card-2" />
  }

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label="Remover foto"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80 disabled:opacity-50"
      >
        {deleting ? '…' : '×'}
      </button>
      <div className="absolute bottom-1 left-1 right-1 flex justify-between">
        <button
          type="button"
          onClick={onMoveLeft}
          disabled={moving || !canMoveLeft}
          aria-label="Mover foto para a posição anterior"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80 disabled:opacity-30"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onMoveRight}
          disabled={moving || !canMoveRight}
          aria-label="Mover foto para a próxima posição"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-black/80 disabled:opacity-30"
        >
          ›
        </button>
      </div>
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

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.deleteCampaignPhoto(campaignId, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] }),
  })

  const reorderPhotos = useMutation({
    mutationFn: (photoIds: string[]) => api.reorderCampaignPhotos(campaignId, photoIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] }),
  })

  function movePhoto(index: number, direction: -1 | 1) {
    if (!photos) return
    const target = index + direction
    if (target < 0 || target >= photos.length) return
    const ids = photos.map((p) => p.id)
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    reorderPhotos.mutate(ids)
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
          Suba todas as fotos da campanha. Vamos agrupar por localidade (GPS) e sugerir carrosséis na próxima etapa.
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

      {photos && photos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {photos.length} foto{photos.length > 1 ? 's' : ''} enviada{photos.length > 1 ? 's' : ''} — use as setas
            pra reordenar
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {photos.map((photo, index) => (
              <UploadedPhotoThumbnail
                key={photo.id}
                url={imageUrls?.[photo.storagePath]}
                deleting={deletePhoto.isPending && deletePhoto.variables === photo.id}
                onDelete={() => {
                  if (confirm('Remover esta foto da campanha?')) deletePhoto.mutate(photo.id)
                }}
                moving={reorderPhotos.isPending}
                canMoveLeft={index > 0}
                canMoveRight={index < photos.length - 1}
                onMoveLeft={() => movePhoto(index, -1)}
                onMoveRight={() => movePhoto(index, 1)}
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

      <button
        type="button"
        onClick={() => generateTimeline.mutate()}
        disabled={!photos || photos.length === 0 || generateTimeline.isPending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
      >
        {generateTimeline.isPending ? 'Gerando linha do tempo…' : 'Gerar linha do tempo'}
      </button>
    </div>
  )
}
