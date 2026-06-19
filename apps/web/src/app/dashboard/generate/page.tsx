'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api, type ApiGenerationRequest } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

const ARTIFACT_STATUS_LABELS: Record<string, string> = {
  pending: 'Na fila',
  generating: 'Gerando…',
  ready: 'Pronto',
  failed: 'Falhou',
}

function GeneratedImage({ path }: { path: string }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['generation-image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-100">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!url) return null

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Artefato gerado" className="aspect-square w-full rounded-lg object-cover" />
}

export default function GenerateContentPage() {
  const router = useRouter()
  const [description, setDescription] = useState('')
  const [textContent, setTextContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [artifactCount, setArtifactCount] = useState(1)
  const [topicSuggestionId, setTopicSuggestionId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ApiGenerationRequest | null>(null)
  const [error, setError] = useState('')

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  const { data: suggestions } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: () => api.getTopicSuggestions(),
  })

  const connectedPlatforms = connections?.map((c) => c.platform) ?? []

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const canGenerate = description.trim().length > 0 && selectedPlatforms.size > 0 && !generating

  const handleGenerate = async () => {
    setError('')
    setGenerating(true)
    try {
      const generationRequest = await api.generateContent({
        description: description.trim(),
        ...(textContent.trim() && { textContent: textContent.trim() }),
        targetPlatforms: [...selectedPlatforms],
        artifactCount,
        ...(topicSuggestionId && { topicSuggestionId }),
      })
      setResult(generationRequest)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar conteúdo.')
    } finally {
      setGenerating(false)
    }
  }

  if (result) {
    const readyArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'ready') ?? []
    const failedArtifacts = result.outputs?.artifacts.filter((a) => a.status === 'failed') ?? []

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Resultado da Geração</h1>

        {result.status === 'ready' ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-800">
              Rascunho criado com sucesso! Encontre-o em breve na sua lista de posts.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Falha na geração: {result.error}</p>
          </div>
        )}

        {result.outputs?.cta && (
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">CTA sugerido:</span> {result.outputs.cta}
          </p>
        )}

        {result.outputs && Object.keys(result.outputs.copies).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Copy gerada</h2>
            {Object.entries(result.outputs.copies).map(([platform, copy]) => (
              <div key={platform} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  {PLATFORM_LABELS[platform as Platform]}
                </p>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{copy?.text}</p>
              </div>
            ))}
          </section>
        )}

        {(readyArtifacts.length > 0 || failedArtifacts.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">
              {(result.outputs?.artifacts.length ?? 0) > 1 ? 'Carrossel' : 'Imagem'}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {result.outputs?.artifacts.map((artifact) => (
                <div key={artifact.position} className="space-y-1">
                  {artifact.status === 'ready' && artifact.imageStoragePath ? (
                    <GeneratedImage path={artifact.imageStoragePath} />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                      {ARTIFACT_STATUS_LABELS[artifact.status]}
                    </div>
                  )}
                  <p className="text-center text-xs text-gray-400">#{artifact.position}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="text-sm font-medium text-gray-700">Gerando copy e imagens…</p>
        <p className="max-w-sm text-xs text-gray-400">
          Isso pode levar até 2 minutos, especialmente para carrosséis com várias imagens. Não saia desta página.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Gerar Conteúdo com IA</h1>
      </div>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Descreva o que você quer publicar
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Ex: Lançamento da nova funcionalidade de relatórios automáticos…"
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Texto-base (opcional)
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={2}
            placeholder="Cole um rascunho ou referência para a IA usar como ponto de partida…"
            className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {suggestions && suggestions.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Pauta sugerida (opcional)
            </label>
            <select
              value={topicSuggestionId}
              onChange={(e) => setTopicSuggestionId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Nenhuma — usar apenas a descrição</option>
              {suggestions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.headline}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">Plataformas</label>
          {loadingConnections ? (
            <p className="text-sm text-gray-400">Carregando conexões…</p>
          ) : connectedPlatforms.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nenhuma plataforma conectada.{' '}
              <a href="/dashboard" className="text-brand-600 underline">
                Conectar agora
              </a>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    selectedPlatforms.has(p)
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-brand-400'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-gray-700">
            Quantidade de artefatos
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={10}
              value={artifactCount}
              onChange={(e) => setArtifactCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-gray-400">
              {artifactCount === 1 ? 'Post único' : `Carrossel com ${artifactCount} imagens`}
            </p>
          </div>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
      >
        Gerar Conteúdo
      </button>
    </div>
  )
}
