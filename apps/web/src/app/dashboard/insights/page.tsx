'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiPerformanceSuggestion } from '../../../lib/api'

const WEEKDAY_LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function isGoodTimeNow(suggestion: ApiPerformanceSuggestion): boolean {
  const now = new Date()
  const weekday = now.getDay()
  const hour = now.getHours()
  if (!suggestion.bestTimeWeekdays.includes(weekday)) return false
  return hour >= suggestion.bestTimeHourStart && hour <= suggestion.bestTimeHourEnd
}

function InsightCard({ suggestion }: { suggestion: ApiPerformanceSuggestion }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const goodTimeNow = isGoodTimeNow(suggestion)

  const shelveMutation = useMutation({
    mutationFn: (shelved: boolean) => api.setPerformanceSuggestionShelved(suggestion.id, shelved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelved-performance-suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['performance-suggestions'] })
    },
  })

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      {goodTimeNow && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          🟢 Bom momento para publicar agora
        </span>
      )}

      <div className="flex items-start gap-3">
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#e91e8c ${suggestion.viralScore}%, #fbe2ef ${suggestion.viralScore}%)` }}
        >
          <div className="flex h-9 w-9 flex-col items-center justify-center rounded-full bg-white">
            <span className="text-xs font-bold text-brand-700">{Math.round(suggestion.viralScore)}</span>
          </div>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-gray-800">{suggestion.headline}</p>
          <p className="text-xs text-gray-500">{suggestion.rationale}</p>
        </div>
      </div>

      {suggestion.bestTimeToPost && (
        <p className="text-xs font-medium text-brand-600">⏰ {suggestion.bestTimeToPost}</p>
      )}

      {suggestion.basedOnThemes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.basedOnThemes.map((theme) => (
            <span
              key={theme}
              className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600"
            >
              {theme}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => router.push(`/dashboard/generate?seed=${encodeURIComponent(suggestion.headline)}`)}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Criar post disso
        </button>
        <button
          onClick={() => shelveMutation.mutate(!suggestion.shelved)}
          disabled={shelveMutation.isPending}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {suggestion.shelved ? 'Remover da prateleira' : 'Guardar na prateleira'}
        </button>
      </div>
    </div>
  )
}

export default function InsightsBankPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'shelved' | 'fresh'>('shelved')

  const { data: shelved, isLoading: loadingShelved } = useQuery({
    queryKey: ['shelved-performance-suggestions'],
    queryFn: () => api.getShelvedPerformanceSuggestions(),
  })

  const { data: fresh, isLoading: loadingFresh, isError: freshError } = useQuery({
    queryKey: ['performance-suggestions'],
    queryFn: () => api.getPerformanceSuggestions(),
    retry: false,
  })

  const freshUnshelved = fresh?.filter((s) => !s.shelved) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Banco de Insights</h1>
      </div>

      <p className="text-sm text-gray-500">
        Ideias de posts que a IA sugeriu com base na performance da sua marca. Guarde as que quiser publicar
        depois — a IA te avisa aqui quando chegar um bom momento pra postar.
      </p>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('shelved')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'shelved' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Guardadas
        </button>
        <button
          onClick={() => setTab('fresh')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'fresh' ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Novas sugestões
        </button>
      </div>

      {tab === 'shelved' ? (
        loadingShelved ? (
          <p className="text-sm text-gray-400">Carregando prateleira…</p>
        ) : !shelved || shelved.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma ideia guardada ainda. Vá na aba &quot;Novas sugestões&quot; ou na tela de geração de conteúdo
            e clique em &quot;Guardar na prateleira&quot;.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shelved.map((s) => (
              <InsightCard key={s.id} suggestion={s} />
            ))}
          </div>
        )
      ) : loadingFresh ? (
        <p className="text-sm text-gray-400">Analisando seus posts publicados…</p>
      ) : freshError || freshUnshelved.length === 0 ? (
        <p className="text-sm text-gray-400">
          Nenhuma sugestão nova por enquanto. Publique mais posts para a IA aprender com a performance da sua
          marca.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {freshUnshelved.map((s) => (
            <InsightCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  )
}
