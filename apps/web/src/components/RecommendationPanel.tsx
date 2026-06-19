interface RecommendationPanelProps {
  agentLabel?: string
  children: React.ReactNode
}

export function RecommendationPanel({ agentLabel = 'o assistente', children }: RecommendationPanelProps) {
  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        Recomendado por {agentLabel}
      </p>
      <div className="space-y-4">{children}</div>
    </aside>
  )
}
