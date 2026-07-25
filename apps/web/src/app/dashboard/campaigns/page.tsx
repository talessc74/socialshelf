'use client'

import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { ApiPhotoCampaign } from '../../../lib/api'
import { CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS } from '@socialshelf/domain'

const STATUS_LABELS: Record<ApiPhotoCampaign['status'], { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-card-2 text-muted' },
  reviewing: { label: 'Em revisão', className: 'bg-amber-50 text-amber-700' },
  active: { label: 'Ativa', className: 'bg-emerald-50 text-emerald-700' },
  paused: { label: 'Pausada', className: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Concluída', className: 'bg-accent-soft text-accent' },
  cancelled: { label: 'Cancelada', className: 'bg-card-2 text-muted' },
}

function nextStepFor(campaign: ApiPhotoCampaign): { href: string; label: string } {
  if (campaign.status === 'draft') {
    // "Subir fotos" só faz sentido pra um rascunho vazio — um rascunho que já tem fotos
    // (upload interrompido, ou timeline ainda não gerada) precisa de um rótulo diferente,
    // senão parece que ele vai perder o que já subiu.
    const label = campaign.photoCount && campaign.photoCount > 0 ? 'Continuar upload' : 'Subir fotos'
    return { href: `/dashboard/campaigns/${campaign.id}/upload`, label }
  }
  if (campaign.status === 'reviewing') return { href: `/dashboard/campaigns/${campaign.id}/timeline`, label: 'Revisar linha do tempo' }
  return { href: `/dashboard/campaigns/${campaign.id}/timeline`, label: 'Ver linha do tempo' }
}

// Uma campanha aceita fotos novas a qualquer momento — na preparação (reviewing) ou já ativa
// publicando (active). draft já tem seu próprio link de upload via nextStepFor; completed e
// cancelled são estados terminais, sem mais nada a agendar.
const CAN_ADD_PHOTOS_STATUSES = new Set<ApiPhotoCampaign['status']>(['reviewing', 'active'])

// Cancelar é permitido em qualquer estado que não seja terminal — espelha a mesma validação do
// CancelCampaignUseCase no backend (completed/cancelled são os únicos bloqueados).
const CANCELLABLE_STATUSES = new Set<ApiPhotoCampaign['status']>(['draft', 'reviewing', 'active', 'paused'])

// Só campanhas já canceladas podem ser descartadas — espelha DiscardCampaignUseCase, que
// rejeita qualquer outro status. Descartar é a versão sob demanda do prazo de retenção
// automático (_local-edr-policy-067): o usuário não precisa esperar os 7 dias.
const DISCARDABLE_STATUSES = new Set<ApiPhotoCampaign['status']>(['cancelled'])
const PAUSABLE_STATUSES = new Set<ApiPhotoCampaign['status']>(['active'])
const RESUMABLE_STATUSES = new Set<ApiPhotoCampaign['status']>(['paused'])

function CampaignRow({ campaign }: { campaign: ApiPhotoCampaign }) {
  const queryClient = useQueryClient()
  const status = STATUS_LABELS[campaign.status]
  const nextStep = nextStepFor(campaign)

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelCampaign(campaign.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const pauseMutation = useMutation({
    mutationFn: () => api.pauseCampaign(campaign.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const resumeMutation = useMutation({
    mutationFn: () => api.resumeCampaign(campaign.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  const discardMutation = useMutation({
    mutationFn: () => api.discardCampaign(campaign.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })

  return (
    <li className="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-card">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-sm font-semibold text-ink">{campaign.name}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
        </div>
        {campaign.description && <p className="mt-1 text-sm text-muted">{campaign.description}</p>}
        {campaign.photoCount !== undefined && campaign.photoCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            {campaign.photoCount} foto{campaign.photoCount > 1 ? 's' : ''} enviada
            {campaign.photoCount > 1 ? 's' : ''}
          </p>
        )}
        {cancelMutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            Não foi possível cancelar: {(cancelMutation.error as Error).message}
          </p>
        )}
        {pauseMutation.isError && (
          <p className="mt-1 text-xs text-red-600">Não foi possível pausar: {(pauseMutation.error as Error).message}</p>
        )}
        {resumeMutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            Não foi possível retomar: {(resumeMutation.error as Error).message}
          </p>
        )}
        {discardMutation.isError && (
          <p className="mt-1 text-xs text-red-600">
            Não foi possível descartar: {(discardMutation.error as Error).message}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PAUSABLE_STATUSES.has(campaign.status) && (
          <button
            type="button"
            onClick={() => pauseMutation.mutate()}
            disabled={pauseMutation.isPending}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-card-2 disabled:opacity-40"
          >
            {pauseMutation.isPending ? 'Pausando…' : 'Pausar campanha'}
          </button>
        )}
        {RESUMABLE_STATUSES.has(campaign.status) && (
          <button
            type="button"
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90 disabled:opacity-40"
          >
            {resumeMutation.isPending ? 'Retomando…' : 'Retomar campanha'}
          </button>
        )}
        {CANCELLABLE_STATUSES.has(campaign.status) && (
          <button
            type="button"
            onClick={() => {
              const activeWarning =
                campaign.status === 'active' || campaign.status === 'paused'
                  ? ' Posts ainda não publicados serão apagados; os já publicados continuam no histórico.'
                  : ''
              if (
                confirm(
                  `Tem certeza que deseja cancelar a campanha "${campaign.name}"?${activeWarning} As fotos ainda não usadas em nenhum post serão apagadas do armazenamento em ${CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS} dias. Essa ação não pode ser desfeita.`,
                )
              ) {
                cancelMutation.mutate()
              }
            }}
            disabled={cancelMutation.isPending}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {cancelMutation.isPending ? 'Cancelando…' : 'Cancelar campanha'}
          </button>
        )}
        {DISCARDABLE_STATUSES.has(campaign.status) && (
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  `Tem certeza que deseja descartar a campanha "${campaign.name}"? As fotos ainda não usadas em nenhum post serão apagadas do armazenamento agora mesmo, não em ${CANCELLED_CAMPAIGN_PHOTO_RETENTION_DAYS} dias. A campanha some por completo dos nossos servidores e você não terá mais acesso a ela. Essa ação não pode ser desfeita.`,
                )
              ) {
                discardMutation.mutate()
              }
            }}
            disabled={discardMutation.isPending}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {discardMutation.isPending ? 'Descartando…' : 'Descartar'}
          </button>
        )}
        {CAN_ADD_PHOTOS_STATUSES.has(campaign.status) && (
          <Link
            href={`/dashboard/campaigns/${campaign.id}/upload`}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card-2"
          >
            Adicionar fotos
          </Link>
        )}
        <Link
          href={nextStep.href}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card-2"
        >
          {nextStep.label}
        </Link>
      </div>
    </li>
  )
}

export default function CampaignsPage() {
  const {
    data: campaigns,
    isLoading,
    error,
  } = useQuery({ queryKey: ['campaigns'], queryFn: api.listCampaigns })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Campanhas de fotos</h1>
          <p className="text-sm text-muted">
            Suba um lote de fotos e deixe o SocialShelf publicar automaticamente, agrupando por localidade.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          Nova campanha
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-red-600">
          Não foi possível carregar as campanhas: {(error as Error).message}
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted">Carregando campanhas…</p>
      ) : !campaigns || campaigns.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-muted">
          Nenhuma campanha ainda. Crie a primeira pra subir suas fotos e deixar a publicação no automático.
        </p>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((campaign) => (
            <CampaignRow key={campaign.id} campaign={campaign} />
          ))}
        </ul>
      )}
    </div>
  )
}
