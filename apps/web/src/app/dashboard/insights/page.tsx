'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ApiPerformanceSuggestion } from '../../../lib/api'
import { NewsCarousel } from '../../../components/NewsCarousel'
import { NewsSearch } from '../../../components/NewsSearch'

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
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-card hover:shadow-card-elev">
      {goodTimeNow && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          🟢 Bom momento para publicar agora
        </span>
      )}

      <div className="flex items-start gap-3">
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(#0369a1 ${suggestion.viralScore}%, #bae6fd ${suggestion.viralScore}%)` }}
        >
          <div className="flex h-9 w-9 flex-col items-center justify-center rounded-full bg-card">
            <span className="text-xs font-bold text-accent">{Math.round(suggestion.viralScore)}</span>
          </div>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-ink">{suggestion.headline}</p>
          <p className="text-xs text-muted">{suggestion.rationale}</p>
        </div>
      </div>

      {suggestion.bestTimeToPost && (
        <p className="text-xs font-medium text-accent">⏰ {suggestion.bestTimeToPost}</p>
      )}

      {suggestion.basedOnThemes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestion.basedOnThemes.map((theme) => (
            <span
              key={theme}
              className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"
            >
              {theme}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => router.push(`/dashboard/generate?seed=${encodeURIComponent(suggestion.headline)}`)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent"
        >
          Criar post disso
        </button>
        <button
          onClick={() => shelveMutation.mutate(!suggestion.shelved)}
          disabled={shelveMutation.isPending}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2"
        >
          {suggestion.shelved ? 'Remover da prateleira' : 'Guardar na prateleira'}
        </button>
      </div>
    </div>
  )
}

export default function InsightsBankPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<'shelved' | 'fresh' | 'news'>(
    searchParams.get('tab') === 'news' ? 'news' : 'shelved',
  )

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
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-ink">Banco de Insights</h1>
      </div>

      <p className="text-sm text-muted">
        Ideias de posts que a IA sugeriu com base na performance da sua marca. Guarde as que quiser publicar
        depois — a IA te avisa aqui quando chegar um bom momento pra postar.
      </p>

      <div className="flex gap-2 border-b border-line">
        <button
          onClick={() => setTab('shelved')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'shelved' ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-ink'
          }`}
        >
          Guardadas
        </button>
        <button
          onClick={() => setTab('fresh')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'fresh' ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-ink'
          }`}
        >
          Novas sugestões
        </button>
        <button
          onClick={() => setTab('news')}
          className={`px-3 py-2 text-sm font-medium ${
            tab === 'news' ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-ink'
          }`}
        >
          Notícias
        </button>
      </div>

      {tab === 'news' ? (
        <div className="space-y-6">
          <NewsSearch />
          <NewsCarousel />
        </div>
      ) : tab === 'shelved' ? (
        loadingShelved ? (
          <p className="text-sm text-muted">Carregando prateleira…</p>
        ) : !shelved || shelved.length === 0 ? (
          <p className="text-sm text-muted">
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
        <p className="text-sm text-muted">Analisando seus posts publicados…</p>
      ) : freshError || freshUnshelved.length === 0 ? (
        <p className="text-sm text-muted">
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
