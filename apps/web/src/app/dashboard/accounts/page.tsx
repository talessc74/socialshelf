'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { LinkedInOrganization, MetaPageOption } from '../../../lib/api'
import { Platform } from '@socialshelf/domain'
import { PLATFORM_META } from '../../../lib/platformMeta'
import { buildAccountsMessage } from '../../../lib/selfieAccountsSummary'
import { useSelfieNarrateOnReady } from '../../../contexts/AssistantContext'

export default function AccountsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [pendingSelection, setPendingSelection] = useState<{
    pendingId: string
    organizations: LinkedInOrganization[]
  } | null>(null)
  const [pendingMetaSelection, setPendingMetaSelection] = useState<{
    pendingId: string
    pages: MetaPageOption[]
  } | null>(null)
  const [selecting, setSelecting] = useState(false)

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })
  useSelfieNarrateOnReady(!isLoading ? buildAccountsMessage(connections ?? []) : null)

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    const linkedinPagePending = searchParams.get('linkedinPagePending')
    const metaPagePending = searchParams.get('metaPagePending')
    const metaResult = searchParams.get('metaResult')

    if (metaResult === 'no-pages') {
      // Meta autenticou, mas a conta não administra nenhuma Página do Facebook — então não há o
      // que conectar (nem Facebook, nem Instagram, já que o Instagram publicável exige uma conta
      // Business/Creator vinculada a uma Página). Explica o pré-requisito em vez do antigo silêncio.
      setNotice({
        type: 'error',
        message:
          'Sua conta autenticou, mas não encontramos nenhuma Página do Facebook nela. Para publicar no Facebook ' +
          'e no Instagram pelo Social Shelf você precisa de uma Página do Facebook — e, para o Instagram, uma conta ' +
          'Business ou Creator vinculada a essa Página. Crie a Página e vincule o Instagram, depois tente conectar de novo.',
      })
      router.replace('/dashboard/accounts')
    } else if (connected) {
      const message =
        connected === 'linkedin-page'
          ? 'Página do LinkedIn conectada com sucesso.'
          : `Conectado com sucesso: ${connected.split(',').join(', ')}`
      setNotice({ type: 'success', message })
      router.replace('/dashboard/accounts')
    } else if (linkedinPagePending) {
      api
        .getLinkedInPagePendingSelection(linkedinPagePending)
        .then((organizations) => setPendingSelection({ pendingId: linkedinPagePending, organizations }))
        .catch(() => setNotice({ type: 'error', message: 'Não foi possível carregar as páginas administradas.' }))
      router.replace('/dashboard/accounts')
    } else if (metaPagePending) {
      api
        .getMetaPagePendingSelection(metaPagePending)
        .then((pages) => setPendingMetaSelection({ pendingId: metaPagePending, pages }))
        .catch(() => setNotice({ type: 'error', message: 'Não foi possível carregar as páginas administradas.' }))
      router.replace('/dashboard/accounts')
    } else if (error) {
      const detail = searchParams.get('detail')
      const message =
        error === 'linkedin_no_organizations'
          ? 'Nenhuma Página do LinkedIn administrada foi encontrada para esta conta.'
          : `Falha ao conectar plataforma. Tente novamente.${detail ? ` [${detail}]` : ''}`
      setNotice({ type: 'error', message })
      router.replace('/dashboard/accounts')
    }
  }, [searchParams, router])

  const connectedPlatforms = new Set(connections?.map((c) => c.platform) ?? [])
  const linkedinConnection = connections?.find((c) => c.platform === Platform.LINKEDIN)
  const connectionByPlatform = new Map(connections?.map((c) => [c.platform, c]) ?? [])

  const handleConnect = async (oauth: 'linkedin' | 'meta' | 'x' | 'tiktok') => {
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

  const handleSelectMetaPage = async (pageId: string) => {
    if (!pendingMetaSelection) return
    setSelecting(true)
    try {
      const { instagramConnected } = await api.selectMetaPage(pendingMetaSelection.pendingId, pageId)
      await queryClient.invalidateQueries({ queryKey: ['connections'] })
      setPendingMetaSelection(null)
      setNotice(
        instagramConnected
          ? { type: 'success', message: 'Facebook e Instagram conectados com sucesso.' }
          : {
              type: 'error',
              message:
                'Facebook conectado. O Instagram NÃO foi conectado: essa Página não tem uma conta Instagram ' +
                'Business ou Creator vinculada. Vincule uma conta profissional do Instagram a essa Página e reconecte.',
            },
      )
    } catch {
      setNotice({ type: 'error', message: 'Não foi possível concluir a seleção da Página.' })
    } finally {
      setSelecting(false)
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

      {pendingSelection && (
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-800">Escolha a Página do LinkedIn</h2>
          <p className="mb-4 text-sm text-gray-500">
            Encontramos mais de uma Página que você administra. Selecione qual conectar a esta marca.
          </p>
          <div className="flex flex-col gap-2">
            {pendingSelection.organizations.map((org) => (
              <button
                key={org.urn}
                disabled={selecting}
                onClick={() => handleSelectOrganization(org.urn)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
              >
                {org.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingMetaSelection && (
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-800">Escolha a Página do Facebook</h2>
          <p className="mb-4 text-sm text-gray-500">
            Encontramos mais de uma Página que você administra. Selecione qual conectar a esta marca —
            o Instagram vinculado a essa Página (se houver) conecta junto.
          </p>
          <div className="flex flex-col gap-2">
            {pendingMetaSelection.pages.map((page) => (
              <button
                key={page.id}
                disabled={selecting}
                onClick={() => handleSelectMetaPage(page.id)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-left text-sm font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
              >
                {page.name}
                {page.instagram_business_account?.username && (
                  <span className="ml-2 text-xs text-gray-400">
                    · Instagram @{page.instagram_business_account.username}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink">Central de Contas</h1>
        <p className="mt-1 text-sm text-muted">Gerencie as redes sociais conectadas à sua marca.</p>
      </div>

      {/* Aviso prévio: reduz a fricção de descobrir só na hora (ou depois) que o Instagram exige
          conta Business/Creator vinculada a uma Página do Facebook — pré-requisito da própria Meta,
          não do Social Shelf. Fica sempre visível, antes de o usuário tentar conectar. */}
      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-gray-700">
        <p className="font-semibold text-gray-800">Antes de conectar o Instagram ou o Facebook</p>
        <p className="mt-1">
          O Instagram só pode publicar por apps quando é uma conta <strong>Business</strong> ou{' '}
          <strong>Creator</strong> vinculada a uma <strong>Página do Facebook</strong> — é uma exigência da
          Meta. Um perfil pessoal do Instagram não consegue ser conectado.
        </p>
        <p className="mt-2 text-gray-600">
          Precisa configurar? No app do Instagram: <em>Configurações → Tipo de conta e ferramentas → Mudar para
          conta profissional</em> e, ao vincular, escolha (ou crie) a Página do Facebook. Depois é só clicar em
          Conectar aqui.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Plataformas Conectadas</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Carregando…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(PLATFORM_META).map(([platform, meta]) => {
              const isConnected = connectedPlatforms.has(platform as Platform)
              const isLinkedIn = platform === Platform.LINKEDIN
              const accountLabel = connectionByPlatform.get(platform as Platform)?.accountLabel
              return (
                <div
                  key={platform}
                  className={`flex flex-col items-start rounded-2xl border p-5 shadow-card transition-shadow hover:shadow-card-elev ${
                    isConnected
                      ? 'border-accent-soft bg-card'
                      : 'border-line bg-card/70'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${meta.color}`}>
                      {meta.emoji}
                    </span>
                    <span className="font-semibold text-ink">{meta.label}</span>
                  </div>
                  {isConnected ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        ● Conectado
                        {isLinkedIn && (linkedinConnection?.organizationUrn ? ' — Página' : ' — Perfil pessoal')}
                      </span>
                      {accountLabel && (
                        <span className="text-xs font-medium text-muted" title="Conta/Página conectada de fato">
                          {accountLabel}
                        </span>
                      )}
                      <button
                        onClick={() => handleConnect(meta.oauth)}
                        className="rounded-full bg-card-2 px-2.5 py-0.5 text-xs font-medium text-muted hover:bg-accent-soft hover:text-accent"
                      >
                        Reconectar
                      </button>
                      {isLinkedIn && (
                        <button
                          onClick={handleConnectLinkedInPage}
                          className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-brand-100 hover:text-brand-700"
                        >
                          Conectar Página do LinkedIn
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => handleConnect(meta.oauth)}
                        className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
                      >
                        Conectar
                      </button>
                      {isLinkedIn && (
                        <button
                          onClick={handleConnectLinkedInPage}
                          className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-brand-100 hover:text-brand-700"
                        >
                          Conectar Página do LinkedIn
                        </button>
                      )}
                    </div>
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
