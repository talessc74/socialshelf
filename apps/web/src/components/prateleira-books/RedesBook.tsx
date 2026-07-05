'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import { api } from '../../lib/api'
import type { LinkedInOrganization } from '../../lib/api'
import { PLATFORM_META } from '../../lib/platformMeta'

const PLATFORM_ORDER = Object.keys(PLATFORM_META) as Platform[]

function useRedesConnections() {
  const queryClient = useQueryClient()
  const [pendingSelection, setPendingSelection] = useState<{
    pendingId: string
    organizations: LinkedInOrganization[]
  } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  const connectedPlatforms = new Set(connections?.map((c) => c.platform) ?? [])
  const linkedinConnection = connections?.find((c) => c.platform === Platform.LINKEDIN)

  const orderedPlatforms = [...PLATFORM_ORDER].sort((a, b) => {
    const aConnected = connectedPlatforms.has(a) ? 0 : 1
    const bConnected = connectedPlatforms.has(b) ? 0 : 1
    return aConnected - bConnected
  })

  const handleConnect = async (oauth: 'linkedin' | 'meta' | 'x') => {
    try {
      const url = await api.getAuthorizeUrl(oauth)
      window.location.href = url
    } catch {
      setNotice({ type: 'error', message: 'Não foi possível iniciar a autenticação.' })
    }
  }

  const handleConnectLinkedInPage = async () => {
    try {
      const url = await api.getLinkedInPageAuthorizeUrl()
      window.location.href = url
    } catch {
      setNotice({ type: 'error', message: 'Não foi possível iniciar a conexão com a Página do LinkedIn.' })
    }
  }

  const handleSelectOrganization = async (organizationUrn: string) => {
    if (!pendingSelection) return
    setSelecting(true)
    try {
      await api.selectLinkedInPage(pendingSelection.pendingId, organizationUrn)
      await queryClient.invalidateQueries({ queryKey: ['connections'] })
      setPendingSelection(null)
      setNotice({ type: 'success', message: 'Página do LinkedIn conectada com sucesso.' })
    } catch {
      setNotice({ type: 'error', message: 'Não foi possível concluir a seleção da Página.' })
    } finally {
      setSelecting(false)
    }
  }

  return {
    isLoading,
    orderedPlatforms,
    connectedPlatforms,
    linkedinConnection,
    pendingSelection,
    selecting,
    notice,
    setNotice,
    handleConnect,
    handleConnectLinkedInPage,
    handleSelectOrganization,
  }
}

interface PlatformCardProps {
  platform: Platform
  isConnected: boolean
  linkedinConnection?: { organizationUrn?: string | null } | undefined
  onConnect: (oauth: 'linkedin' | 'meta' | 'x') => void
  onConnectLinkedInPage: () => void
}

function PlatformCard({ platform, isConnected, linkedinConnection, onConnect, onConnectLinkedInPage }: PlatformCardProps) {
  const meta = PLATFORM_META[platform]
  const isLinkedIn = platform === Platform.LINKEDIN
  const linkedinSubtype = isLinkedIn && isConnected ? (linkedinConnection?.organizationUrn ? 'Página' : 'Perfil pessoal') : null

  return (
    <div
      className={`flex flex-col items-start rounded-xl border p-3 transition-shadow ${
        isConnected ? 'border-green-200 bg-white/80' : 'border-black/10 bg-white/50'
      }`}
      style={{ fontSize: '11px' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${meta.color}`}>
          {meta.emoji}
        </span>
        <span className="font-semibold" style={{ color: 'rgba(0,0,0,0.75)' }}>
          {meta.label}
        </span>
      </div>

      {isConnected ? (
        <div className="flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            ● Conectado{linkedinSubtype ? ` — ${linkedinSubtype}` : ''}
          </span>
          <button
            onClick={() => onConnect(meta.oauth)}
            className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium hover:bg-black/10"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            Reconectar
          </button>
          {isLinkedIn && (
            <button
              onClick={onConnectLinkedInPage}
              className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium hover:bg-black/10"
              style={{ color: 'rgba(0,0,0,0.6)' }}
            >
              Conectar Página do LinkedIn
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium" style={{ color: 'rgba(0,0,0,0.45)' }}>
            ○ Desconectado
          </span>
          <button
            onClick={() => onConnect(meta.oauth)}
            className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${meta.color}`}
          >
            Conectar
          </button>
          {isLinkedIn && (
            <button
              onClick={onConnectLinkedInPage}
              className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium hover:bg-black/10"
              style={{ color: 'rgba(0,0,0,0.6)' }}
            >
              Conectar Página do LinkedIn
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PendingSelectionPanel({
  pendingSelection,
  selecting,
  onSelect,
}: {
  pendingSelection: { pendingId: string; organizations: LinkedInOrganization[] }
  selecting: boolean
  onSelect: (urn: string) => void
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/70 p-3">
      <p className="mb-1 text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.68)' }}>
        Escolha a Página do LinkedIn
      </p>
      <p className="mb-3 text-[10px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
        Encontramos mais de uma Página que você administra.
      </p>
      <div className="flex flex-col gap-1.5">
        {pendingSelection.organizations.map((org) => (
          <button
            key={org.urn}
            disabled={selecting}
            onClick={() => onSelect(org.urn)}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-left text-[11px] font-medium hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
            style={{ color: 'rgba(0,0,0,0.7)' }}
          >
            {org.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function RedesDesktopLeft() {
  const { isLoading, orderedPlatforms, connectedPlatforms, linkedinConnection, notice, handleConnect, handleConnectLinkedInPage } =
    useRedesConnections()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Carregando…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {notice && (
        <div
          className={`rounded-lg px-3 py-2 text-[11px] font-medium ${
            notice.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {orderedPlatforms.map((platform) => (
          <PlatformCard
            key={platform}
            platform={platform}
            isConnected={connectedPlatforms.has(platform)}
            linkedinConnection={linkedinConnection}
            onConnect={handleConnect}
            onConnectLinkedInPage={handleConnectLinkedInPage}
          />
        ))}
      </div>
    </div>
  )
}

export function RedesDesktopRight() {
  const { connectedPlatforms, pendingSelection, selecting, notice, handleSelectOrganization } = useRedesConnections()
  const connectedCount = connectedPlatforms.size

  return (
    <div className="flex flex-1 flex-col gap-3">
      {notice && (
        <div
          className={`rounded-lg px-3 py-2 text-[11px] font-medium ${
            notice.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      {pendingSelection ? (
        <PendingSelectionPanel pendingSelection={pendingSelection} selecting={selecting} onSelect={handleSelectOrganization} />
      ) : (
        <div className="rounded-xl border border-black/10 bg-white/50 p-3" style={{ fontSize: '11px', color: 'rgba(0,0,0,0.65)' }}>
          <p className="font-medium">{connectedCount}/4 redes conectadas</p>
          <p className="mt-1 text-[10px]" style={{ color: 'rgba(0,0,0,0.5)' }}>
            Conecte suas redes para publicar e medir desempenho direto pela SocialShelf.
          </p>
        </div>
      )}
    </div>
  )
}

export function RedesMobile() {
  const {
    isLoading,
    orderedPlatforms,
    connectedPlatforms,
    linkedinConnection,
    pendingSelection,
    selecting,
    notice,
    handleConnect,
    handleConnectLinkedInPage,
    handleSelectOrganization,
  } = useRedesConnections()

  const pages: Array<{ kind: 'platforms'; items: Platform[] } | { kind: 'pending' }> = []
  for (let i = 0; i < orderedPlatforms.length; i += 2) {
    pages.push({ kind: 'platforms', items: orderedPlatforms.slice(i, i + 2) })
  }
  if (pendingSelection) pages.push({ kind: 'pending' })

  const [pageIndex, setPageIndex] = useState(0)
  const currentPage = pages[Math.min(pageIndex, pages.length - 1)]

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-transparent" />
        Carregando…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <div
          className={`rounded-lg px-3 py-2 text-[11px] font-medium ${
            notice.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      {currentPage?.kind === 'platforms' && (
        <div className="flex flex-col gap-2">
          {currentPage.items.map((platform) => (
            <PlatformCard
              key={platform}
              platform={platform}
              isConnected={connectedPlatforms.has(platform)}
              linkedinConnection={linkedinConnection}
              onConnect={handleConnect}
              onConnectLinkedInPage={handleConnectLinkedInPage}
            />
          ))}
        </div>
      )}

      {currentPage?.kind === 'pending' && pendingSelection && (
        <PendingSelectionPanel pendingSelection={pendingSelection} selecting={selecting} onSelect={handleSelectOrganization} />
      )}

      {pages.length > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            ← Anterior
          </button>
          <span className="text-[10px]" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {pageIndex + 1} / {pages.length}
          </span>
          <button
            disabled={pageIndex === pages.length - 1}
            onClick={() => setPageIndex((p) => Math.min(pages.length - 1, p + 1))}
            className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold disabled:opacity-30"
            style={{ color: 'rgba(0,0,0,0.6)' }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}
