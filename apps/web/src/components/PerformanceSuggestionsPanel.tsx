'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

function ViralScoreGauge({ score }: { score: number }) {
  return (
    <div
      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#0369a1 ${score}%, #bae6fd ${score}%)`,
      }}
    >
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full bg-card">
        <span className="text-sm font-bold text-accent">{score}</span>
        <span className="text-[8px] font-medium uppercase text-muted-2">viral</span>
      </div>
    </div>
  )
}

interface PerformanceSuggestionsPanelProps {
  onUseSuggestion: (headline: string) => void
}

export function PerformanceSuggestionsPanel({ onUseSuggestion }: PerformanceSuggestionsPanelProps) {
  const queryClient = useQueryClient()
  const [index, setIndex] = useState(0)

  const { data: suggestions, isLoading, isError } = useQuery({
    queryKey: ['performance-suggestions'],
    queryFn: () => api.getPerformanceSuggestions(),
    retry: false,
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ id, feedback }: { id: string; feedback: 'helpful' | 'not_helpful' }) =>
      api.submitPerformanceSuggestionFeedback(id, feedback),
    onSuccess: (_, { id, feedback }) => {
      queryClient.setQueryData<typeof suggestions>(['performance-suggestions'], (prev) =>
        prev?.map((s) => (s.id === id ? { ...s, feedback } : s)),
      )
    },
  })

  const shelveMutation = useMutation({
    mutationFn: (id: string) => api.setPerformanceSuggestionShelved(id, true),
    onSuccess: (_, id) => {
      queryClient.setQueryData<typeof suggestions>(['performance-suggestions'], (prev) =>
        prev?.map((s) => (s.id === id ? { ...s, shelved: true } : s)),
      )
      queryClient.invalidateQueries({ queryKey: ['shelved-performance-suggestions'] })
    },
  })

  if (isLoading) {
    return (
      <section className="space-y-2 rounded-2xl border border-line bg-card p-5 shadow-card">
        <p className="text-sm font-semibold text-ink">Ideias baseadas na sua performance</p>
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Analisando seus posts publicados…
        </div>
      </section>
    )
  }

  if (isError || !suggestions || suggestions.length === 0) {
    return null
  }

  const suggestion = suggestions[index % suggestions.length]!
  const hasMore = suggestions.length > 1

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-card p-5 shadow-card">
      <p className="text-sm font-semibold text-ink">✨ Ideia baseada na sua performance</p>

      <div className="flex items-start gap-3">
        <ViralScoreGauge score={Math.round(suggestion.viralScore)} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-ink">{suggestion.headline}</p>
          <p className="text-xs text-muted">{suggestion.rationale}</p>
          {suggestion.bestTimeToPost && (
            <p className="text-xs font-medium text-accent">⏰ Melhor momento: {suggestion.bestTimeToPost}</p>
          )}
          {suggestion.basedOnThemes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={() => onUseSuggestion(suggestion.headline)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
        >
          Criar post disso
        </button>
        {hasMore && (
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2"
          >
            Trocar sugestão
          </button>
        )}
        <button
          onClick={() => shelveMutation.mutate(suggestion.id)}
          disabled={suggestion.shelved || shelveMutation.isPending}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-2 disabled:opacity-40"
        >
          {suggestion.shelved ? '📌 Guardada' : 'Guardar na prateleira'}
        </button>

        <span className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => feedbackMutation.mutate({ id: suggestion.id, feedback: 'helpful' })}
            disabled={feedbackMutation.isPending}
            title="Faz sentido"
            className={`rounded-full px-2 py-1 text-xs ${
              suggestion.feedback === 'helpful'
                ? 'bg-green-100 text-green-700'
                : 'text-muted-2 hover:bg-card-2 hover:text-muted'
            }`}
          >
            👍
          </button>
          <button
            onClick={() => feedbackMutation.mutate({ id: suggestion.id, feedback: 'not_helpful' })}
            disabled={feedbackMutation.isPending}
            title="Não faz sentido"
            className={`rounded-full px-2 py-1 text-xs ${
              suggestion.feedback === 'not_helpful'
                ? 'bg-red-100 text-red-700'
                : 'text-muted-2 hover:bg-card-2 hover:text-muted'
            }`}
          >
            👎
          </button>
        </span>
      </div>
    </section>
  )
}
