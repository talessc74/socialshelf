'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import type { ApiPhotoCampaign } from '../../../lib/api'

const STATUS_LABELS: Record<ApiPhotoCampaign['status'], { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-card-2 text-muted' },
  reviewing: { label: 'Em revisão', className: 'bg-amber-50 text-amber-700' },
  active: { label: 'Ativa', className: 'bg-emerald-50 text-emerald-700' },
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
          {campaigns.map((campaign) => {
            const status = STATUS_LABELS[campaign.status]
            const nextStep = nextStepFor(campaign)
            return (
              <li key={campaign.id} className="rounded-2xl border border-line bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-ink">{campaign.name}</h2>
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
                  </div>
                  <Link
                    href={nextStep.href}
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-card-2"
                  >
                    {nextStep.label}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
