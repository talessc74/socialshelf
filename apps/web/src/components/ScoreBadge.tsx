interface ScoreBadgeProps {
  label: string
  score: number
}

/**
 * audienceFitScore é relevanceStrength (0-3, julgado pela IA por relevância
 * semântica ao negócio da marca) * (1 + avgEngagementRate). O badge mostra o
 * valor cru, sem fração tipo "x/3", já que o fator de engajamento desloca o teto.
 */
export function ScoreBadge({ label, score }: ScoreBadgeProps) {
  const variant = score >= 2 ? 'bg-brand-500 text-gray-900' : score >= 1 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${variant}`}>
      {label}
      <span className="opacity-80">{score.toFixed(1)}</span>
    </span>
  )
}
