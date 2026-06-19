'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Platform } from '@socialshelf/domain'

const PLATFORM_META = {
  [Platform.LINKEDIN]: { label: 'LinkedIn', emoji: '💼', color: 'bg-blue-600', oauth: 'linkedin' as const },
  [Platform.FACEBOOK]: { label: 'Facebook', emoji: '👥', color: 'bg-blue-500', oauth: 'meta' as const },
  [Platform.INSTAGRAM]: { label: 'Instagram', emoji: '📸', color: 'bg-pink-500', oauth: 'meta' as const },
  [Platform.TWITTER]: { label: 'X (Twitter)', emoji: '🐦', color: 'bg-black', oauth: 'x' as const },
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      const platforms = connected.split(',').join(', ')
      setNotice({ type: 'success', message: `Conectado com sucesso: ${platforms}` })
      router.replace('/dashboard')
    } else if (error) {
      const detail = searchParams.get('detail')
      setNotice({ type: 'error', message: `Falha ao conectar plataforma. Tente novamente.${detail ? ` [${detail}]` : ''}` })
      router.replace('/dashboard')
    }
  }, [searchParams, router])

  const connectedPlatforms = new Set(connections?.map((c) => c.platform) ?? [])

  const handleConnect = async (oauth: 'linkedin' | 'meta' | 'x') => {
    try {
      const url = await api.getAuthorizeUrl(oauth)
      window.location.href = url
    } catch (err) {
      setNotice({ type: 'error', message: 'Não foi possível iniciar a autenticação.' })
    }
  }

  return (
    <div className="space-y-8">
      {notice && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
          <button
            onClick={() => setNotice(null)}
            className="ml-4 text-xs underline opacity-70"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Painel da marca</p>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/performance"
            className="rounded-xl border border-brand-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-brand-300 hover:bg-brand-50"
          >
            📊 Performance
          </Link>
          <Link
            href="/dashboard/generate"
            className="rounded-xl border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-600 shadow-sm hover:bg-brand-50"
          >
            ✨ Gerar com IA
          </Link>
          <Link
            href="/dashboard/compose"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-200 hover:bg-brand-700"
          >
            + Novo Post
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Plataformas Conectadas</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Carregando…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PLATFORM_META).map(([platform, meta]) => {
              const isConnected = connectedPlatforms.has(platform as Platform)
              return (
                <div
                  key={platform}
                  className={`flex flex-col items-start rounded-2xl border p-5 shadow-sm transition-shadow ${
                    isConnected
                      ? 'border-brand-100 bg-white shadow-brand-100/60'
                      : 'border-gray-200 bg-white/70'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${meta.color}`}>
                      {meta.emoji}
                    </span>
                    <span className="font-semibold text-gray-800">{meta.label}</span>
                  </div>
                  {isConnected ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        ● Conectado
                      </span>
                      <button
                        onClick={() => handleConnect(meta.oauth)}
                        className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-brand-100 hover:text-brand-700"
                      >
                        Reconectar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnect(meta.oauth)}
                      className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-100"
                    >
                      Conectar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
