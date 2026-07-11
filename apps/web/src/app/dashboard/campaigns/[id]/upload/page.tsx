'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'

function UploadedPhotoThumbnail({
  path,
  deleting,
  onDelete,
}: {
  path: string
  deleting: boolean
  onDelete: () => void
}) {
  const { data: url, isLoading } = useQuery({ queryKey: ['image-url', path], queryFn: () => api.getImageUrl(path) })

  if (isLoading || !url) {
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

  const generateTimeline = useMutation({
    mutationFn: () => api.generateCampaignTimeline(campaignId),
    onSuccess: () => router.push(`/dashboard/campaigns/${campaignId}/timeline`),
  })

  const deletePhoto = useMutation({
    mutationFn: (photoId: string) => api.deleteCampaignPhoto(campaignId, photoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] }),
  })

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
            {photos.length} foto{photos.length > 1 ? 's' : ''} enviada{photos.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {photos.map((photo) => (
              <UploadedPhotoThumbnail
                key={photo.id}
                path={photo.storagePath}
                deleting={deletePhoto.isPending && deletePhoto.variables === photo.id}
                onDelete={() => {
                  if (confirm('Remover esta foto da campanha?')) deletePhoto.mutate(photo.id)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {deletePhoto.isError && <p className="text-sm text-red-600">{(deletePhoto.error as Error).message}</p>}

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
