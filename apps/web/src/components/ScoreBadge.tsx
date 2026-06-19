interface ScoreBadgeProps {
  label: string
  score: number
}

/**
 * audienceFitScore (e SuggestTopicsUseCase.ts) não tem teto fixo — é
 * matchedThemes * (1 + avgEngagementRate). Por isso o badge mostra o
 * valor cru, sem fração tipo "x/3", que sugeriria uma escala que não existe.
 */
export function ScoreBadge({ label, score }: ScoreBadgeProps) {
  const variant = score >= 2 ? 'bg-brand-500 text-white' : score >= 1 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${variant}`}>
      {label}
      <span className="opacity-80">{score.toFixed(1)}</span>
    </span>
  )
}
