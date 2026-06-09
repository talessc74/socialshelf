'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { Platform, PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

function CharCounter({ current, max }: { current: number; max: number }) {
  const remaining = max - current
  const pct = current / max
  return (
    <span
      className={`text-xs tabular-nums ${
        pct >= 1 ? 'font-bold text-red-600' : pct >= 0.9 ? 'text-orange-500' : 'text-gray-400'
      }`}
    >
      {remaining}
    </span>
  )
}

export default function ComposePage() {
  const router = useRouter()
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set())
  const [texts, setTexts] = useState<Partial<Record<Platform, string>>>({})
  const [synced, setSynced] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<{
    results: Array<{ platform: Platform; externalId: string }>
    failedPlatforms: Array<{ platform: Platform; reason: string }>
  } | null>(null)
  const [error, setError] = useState('')

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  const validPlatforms = new Set(Object.values(Platform))
  const connectedPlatforms = connections
    ?.map((c) => c.platform as Platform)
    .filter((p) => validPlatforms.has(p)) ?? []

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const masterText = texts[Platform.LINKEDIN] ?? texts[Platform.FACEBOOK] ?? texts[Platform.TWITTER] ?? texts[Platform.INSTAGRAM] ?? ''

  const handleTextChange = (platform: Platform, value: string) => {
    if (synced) {
      const newTexts: Partial<Record<Platform, string>> = {}
      selectedPlatforms.forEach((p) => { newTexts[p] = value })
      setTexts(newTexts)
    } else {
      setTexts((prev) => ({ ...prev, [platform]: value }))
    }
  }

  const handleSyncToggle = () => {
    if (!synced) {
      // Enable sync: copy master text to all
      const newTexts: Partial<Record<Platform, string>> = {}
      selectedPlatforms.forEach((p) => { newTexts[p] = masterText })
      setTexts(newTexts)
    }
    setSynced((v) => !v)
  }

  const canPublish =
    selectedPlatforms.size > 0 &&
    [...selectedPlatforms].every((p) => {
      const t = texts[p] ?? ''
      return t.trim().length > 0 && t.length <= PLATFORM_CHARACTER_LIMITS[p]
    })

  const handlePublish = async () => {
    setError('')
    setPublishing(true)
    try {
      const content = [...selectedPlatforms].map((platform) => ({
        platform,
        text: texts[platform] ?? '',
      }))

      const post = await api.createPost(content)
      const publishResult = await api.publishPost(post.id)
      setResult(publishResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar.')
    } finally {
      setPublishing(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Resultado</h1>
        {result.results.length > 0 && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="mb-2 font-semibold text-green-800">Publicado com sucesso:</p>
            <ul className="space-y-1">
              {result.results.map((r) => (
                <li key={r.platform} className="text-sm text-green-700">
                  ✓ {PLATFORM_LABELS[r.platform]} — ID: {r.externalId}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.failedPlatforms.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="mb-2 font-semibold text-red-800">Falhou:</p>
            <ul className="space-y-1">
              {result.failedPlatforms.map((f) => (
                <li key={f.platform} className="text-sm text-red-700">
                  ✗ {PLATFORM_LABELS[f.platform]} — {f.reason}
                </li>
              ))}
            </ul>
          </div>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Novo Post</h1>
      </div>

      {/* Platform selector */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Plataformas</h2>
        {isLoading ? (
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
      </section>

      {/* Text areas */}
      {selectedPlatforms.size > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Conteúdo</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={synced}
                onChange={handleSyncToggle}
                className="accent-brand-600"
              />
              Mesmo texto para todas
            </label>
          </div>
          {[...selectedPlatforms].map((platform) => {
            const text = texts[platform] ?? ''
            const limit = PLATFORM_CHARACTER_LIMITS[platform]
            return (
              <div
                key={platform}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{PLATFORM_LABELS[platform]}</span>
                  <CharCounter current={text.length} max={limit} />
                </div>
                <textarea
                  value={text}
                  onChange={(e) => handleTextChange(platform, e.target.value)}
                  rows={4}
                  placeholder={`Escreva para ${PLATFORM_LABELS[platform]}…`}
                  className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )
          })}
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {selectedPlatforms.size > 0 && (
        <button
          onClick={handlePublish}
          disabled={!canPublish || publishing}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
        >
          {publishing ? 'Publicando…' : 'Publicar Agora'}
        </button>
      )}
    </div>
  )
}
