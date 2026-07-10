'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../../../lib/api'

export default function CampaignUploadPage() {
  const params = useParams<{ id: string }>()
  const campaignId = params.id
  const router = useRouter()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

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
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        await api.uploadCampaignPhoto(campaignId, file)
      }
      await queryClient.invalidateQueries({ queryKey: ['campaign-photos', campaignId] })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Falha ao subir as fotos')
    } finally {
      setUploading(false)
    }
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
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-card p-8 text-center hover:border-accent"
      >
        <span className="text-sm font-semibold text-ink">
          {uploading ? 'Enviando fotos…' : 'Clique para escolher as fotos'}
        </span>
        <span className="text-xs text-muted">JPEG, PNG ou WEBP — pode selecionar várias de uma vez</span>
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
        <p className="text-sm text-muted">
          {photos.length} foto{photos.length > 1 ? 's' : ''} enviada{photos.length > 1 ? 's' : ''}.
        </p>
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
