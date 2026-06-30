interface RecommendationPanelProps {
  agentLabel?: string
  children: React.ReactNode
}

export function RecommendationPanel({ agentLabel = 'o assistente', children }: RecommendationPanelProps) {
  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-line bg-card p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Recomendado por {agentLabel}
      </p>
      <div className="space-y-4">{children}</div>
    </aside>
  )
}
