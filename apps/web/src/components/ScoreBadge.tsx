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
  const variant = score >= 2 ? 'bg-accent text-accent-ink' : score >= 1 ? 'bg-accent-soft text-accent' : 'bg-card-2 text-muted'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${variant}`}>
      {label}
      <span className="opacity-80">{score.toFixed(1)}</span>
    </span>
  )
}
