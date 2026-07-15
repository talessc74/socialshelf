'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import { api } from '../../../../lib/api'
import { PLATFORM_META } from '../../../../lib/platformMeta'
import { useClampedNumberInput } from '../../../../lib/useClampedNumberInput'

export default function NewCampaignPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [keywordsInput, setKeywordsInput] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const postsPerDay = useClampedNumberInput(2, 1, 10)
  const carouselSizeDefault = useClampedNumberInput(5, 1, 20)

  const { data: connections, error: connectionsError } = useQuery({
    queryKey: ['connections'],
    queryFn: api.getConnections,
  })
  // X (Twitter) não publica nenhuma imagem hoje (_local-adr-policy-041) — fica fora do
  // seletor de campanha de fotos, mesmo se estiver conectado.
  const connectedPlatforms = (connections ?? [])
    .map((c) => c.platform)
    .filter((p) => p !== Platform.TWITTER)

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const createCampaign = useMutation({
    mutationFn: () =>
      api.createCampaign({
        name: name.trim(),
        description: description.trim(),
        keywords: keywordsInput
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
        platforms: [...selectedPlatforms],
        postsPerDay: postsPerDay.value,
        carouselSizeDefault: carouselSizeDefault.value,
      }),
    onSuccess: (campaign) => {
      router.push(`/dashboard/campaigns/${campaign.id}/upload`)
    },
  })

  const canSubmit = name.trim().length > 0 && selectedPlatforms.size > 0 && !createCampaign.isPending

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Nova campanha de fotos</h1>
        <p className="text-sm text-muted">
          Conte do que se trata esse conjunto de fotos — vamos usar isso pra sugerir legendas e agrupar por localidade.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createCampaign.mutate()
        }}
        className="space-y-5"
      >
        <div>
          <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-semibold text-ink">
            Nome da campanha
          </label>
          <input
            id="campaign-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Viagem à Europa"
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
          />
        </div>

        <div>
          <label htmlFor="campaign-description" className="mb-1.5 block text-sm font-semibold text-ink">
            Descrição
          </label>
          <textarea
            id="campaign-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Fotos da viagem de verão pela Europa — Paris, Roma e Barcelona"
            rows={3}
            className="w-full resize-none rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
          />
        </div>

        <div>
          <label htmlFor="campaign-keywords" className="mb-1.5 block text-sm font-semibold text-ink">
            Palavras-chave <span className="font-normal text-muted">(separadas por vírgula)</span>
          </label>
          <input
            id="campaign-keywords"
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="viagem, europa, verão"
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Redes desta campanha</span>
          {connectionsError ? (
            <p className="text-sm text-red-600">
              Não foi possível carregar as redes conectadas: {(connectionsError as Error).message}
            </p>
          ) : connectedPlatforms.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma plataforma conectada que aceite fotos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    selectedPlatforms.has(p)
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line bg-card text-muted hover:border-accent'
                  }`}
                >
                  {PLATFORM_META[p].emoji} {PLATFORM_META[p].label}
                </button>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted">
            X (Twitter) não aparece aqui — hoje ele não publica nenhuma imagem, só texto.
          </p>
        </div>

        <div className="flex gap-4">
          <div>
            <label htmlFor="posts-per-day" className="mb-1.5 block text-sm font-semibold text-ink">
              Posts por dia
            </label>
            <input
              id="posts-per-day"
              type="number"
              min={1}
              max={10}
              value={postsPerDay.inputValue}
              onChange={postsPerDay.onChange}
              onBlur={postsPerDay.onBlur}
              className="w-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label htmlFor="carousel-size" className="mb-1.5 block text-sm font-semibold text-ink">
              Tamanho do carrossel
            </label>
            <input
              id="carousel-size"
              type="number"
              min={1}
              max={20}
              value={carouselSizeDefault.inputValue}
              onChange={carouselSizeDefault.onChange}
              onBlur={carouselSizeDefault.onBlur}
              className="w-24 rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
            />
            <p className="mt-1 text-xs text-muted">
              Padrão pra agrupar fotos da mesma localidade. Editável por grupo na revisão.
            </p>
          </div>
        </div>

        {createCampaign.isError && (
          <p className="text-sm text-red-600">{(createCampaign.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
        >
          {createCampaign.isPending ? 'Criando…' : 'Criar campanha e subir fotos'}
        </button>
      </form>
    </div>
  )
}
