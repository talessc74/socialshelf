'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'

function UploadedPhotoThumbnail({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({ queryKey: ['image-url', path], queryFn: () => api.getImageUrl(path) })

  if (isLoading || !url) {
    return <div className="aspect-square w-full animate-pulse rounded-lg bg-card-2" />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
}

export default function CampaignUploadPage() {
  const params = useParams<{ id: string }>()
  const campaignId = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data: campaign } = useQuery({ queryKey: ['campaign', campaignId], queryFn: () => api.getCampaign(campaignId) })
  const { data: photos } = useQuery({
    queryKey: ['campaign-photos', campaignId],
    queryFn: () => api.getCampaignPhotos(campaignId),
  })

  const generateTimeline = useMutation({
    mutationFn: () => api.generateCampaignTimeline(campaignId),
    onSuccess: () => router.push(`/dashboard/campaigns/${campaignId}/timeline`),
  })

  // Um arquivo por requisição, o cliente faz o loop — mesmo padrão já usado no upload de
  // imagem manual (compose/generate), já que o multipart do api-service aceita 1 arquivo por vez.
  // Cada foto é isolada em try/catch (mesmo padrão de AutonomyTickUseCase/GetPostsPerformanceUseCase):
  // uma falha no meio de um lote grande não pode impedir as demais de subir nem esconder da tela
  // as que já subiram — por isso a lista é sempre atualizada no final, com sucesso ou não.
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    const failures: string[] = []
    for (const file of Array.from(files)) {
      try {
        await api.uploadCampaignPhoto(campaignId, file)
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : 'falha desconhecida'}`)
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] })
    if (failures.length > 0) {
      const shown = failures.slice(0, 3).join('; ')
      const rest = failures.length > 3 ? ` (e mais ${failures.length - 3})` : ''
      setUploadError(`${failures.length} de ${files.length} foto(s) não subiram: ${shown}${rest}`)
    }
    setUploading(false)
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
          {uploading ? 'Enviando fotos…' : isDragging ? 'Solte as fotos aqui' : 'Clique ou arraste as fotos aqui'}
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

      {photos && photos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">
            {photos.length} foto{photos.length > 1 ? 's' : ''} enviada{photos.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {photos.map((photo) => (
              <UploadedPhotoThumbnail key={photo.id} path={photo.storagePath} />
            ))}
          </div>
        </div>
      )}

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
