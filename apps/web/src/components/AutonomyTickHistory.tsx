'use client'

import { useQuery } from '@tanstack/react-query'
import { api, type ApiAutonomyTickAction } from '../lib/api'

// Rótulo + cor por ação possível do tick (packages/domain AutonomyTickAction) — sem isso, o
// resultado de cada tentativa só existia por um instante na resposta HTTP que o Cloud
// Scheduler recebe e descarta (_local-edr-policy-038, adendo 2026-07-11).
const ACTION_INFO: Record<ApiAutonomyTickAction, { label: string; className: string }> = {
  published: { label: 'Publicado com sucesso', className: 'bg-emerald-50 text-emerald-700' },
  'draft-created': {
    label: 'Rascunho criado — aguardando aprovação',
    className: 'bg-sky-50 text-sky-700',
  },
  'skipped-no-platforms': {
    label: 'Pulado — nenhuma rede social conectada (fora o TikTok)',
    className: 'bg-card-2 text-muted',
  },
  'skipped-not-yet-time': {
    label: 'Pulado — ainda não é hora do próximo post do dia',
    className: 'bg-card-2 text-muted',
  },
  'skipped-no-suggestions': {
    label: 'Pulado — nenhuma notícia/pauta disponível',
    className: 'bg-card-2 text-muted',
  },
  'skipped-blocked': {
    label: 'Pulado — a pauta bateu num tópico bloqueado',
    className: 'bg-amber-50 text-amber-700',
  },
  'skipped-not-eligible': {
    label: 'Pulado — a pauta está fora dos tópicos liberados para automático',
    className: 'bg-amber-50 text-amber-700',
  },
  'skipped-daily-limit': {
    label: 'Pulado — limite diário de posts automáticos já atingido',
    className: 'bg-card-2 text-muted',
  },
  error: { label: 'Erro ao gerar ou publicar', className: 'bg-red-50 text-red-700' },
}

export function AutonomyTickHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['autonomy-tick-log'],
    queryFn: () => api.getAutonomyTickLog(),
  })

  return (
    <div className="space-y-2 rounded-xl border border-line bg-card-2/40 p-3">
      <div>
        <p className="text-sm font-semibold text-ink">Histórico do tick automático</p>
        <p className="text-xs text-muted">
          O que aconteceu nas últimas tentativas — de hora em hora, entre 9h e 21h.
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted">Carregando…</p>
      ) : error ? (
        <p className="text-xs text-red-600">Não foi possível carregar o histórico.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted">
          Nenhuma tentativa registrada ainda. A próxima é ao vivo, no próximo horário cheio.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((entry) => {
            const info = ACTION_INFO[entry.action]
            return (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.className}`}
                  >
                    {info.label}
                  </span>
                  {entry.topicHeadline && <p className="mt-1 truncate text-xs text-muted">{entry.topicHeadline}</p>}
                  {entry.error && <p className="mt-1 break-words text-xs text-red-600">{entry.error}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted">
                  {new Date(entry.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
