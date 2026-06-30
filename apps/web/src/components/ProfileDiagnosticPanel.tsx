import type { ProfileDiagnostic } from '@socialshelf/domain'

interface ProfileDiagnosticPanelProps {
  diagnostic: ProfileDiagnostic
  postsAnalyzed: number
  onCreatePost?: () => void
}

export function ProfileDiagnosticPanel({ diagnostic, postsAnalyzed, onCreatePost }: ProfileDiagnosticPanelProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-2">Posts analisados</p>
          <p className="text-2xl font-bold text-ink">{postsAnalyzed}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-2">Potencial viral</p>
          <p className="text-2xl font-bold text-ink">{diagnostic.viralPotential} de 100</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-2">Melhor janela</p>
          <p className="text-2xl font-bold text-ink">{diagnostic.bestTimes[0] ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-accent/30 bg-accent-soft p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">
          Nicho detectado pelos dados
        </p>
        <h3 className="mb-2 text-xl font-bold text-ink">{diagnostic.niche}</h3>
        <p className="text-sm text-muted">{diagnostic.diagnosisSummary}</p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-muted">O que já funciona</h3>
        <ul className="space-y-3">
          {diagnostic.whatWorks.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs text-accent">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-muted">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-card p-6 text-center shadow-card">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-line">
          <span className="text-3xl font-bold text-accent">{diagnostic.viralPotential}</span>
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-2">
          Potencial viral do seu perfil hoje
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-muted">Temas que engajam</h3>
        <ul className="space-y-3">
          {diagnostic.engagingThemes.map((theme, i) => (
            <li key={i}>
              <p className="mb-1 text-sm font-medium text-ink">{theme.label}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-card-2">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${theme.strength}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-muted">Formatos que performam</h3>
          <div className="flex flex-wrap gap-1.5">
            {diagnostic.topFormats.map((format) => (
              <span
                key={format}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-muted">Melhores horários</h3>
          <div className="flex flex-wrap gap-1.5">
            {diagnostic.bestTimes.map((time) => (
              <span
                key={time}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
              >
                {time}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h3 className="mb-2 text-sm font-semibold text-muted">Engajamento</h3>
        <p className="text-sm text-muted">{diagnostic.engagementAnalysis}</p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
        <h3 className="mb-1 text-sm font-semibold text-muted">Plano de ação</h3>
        <p className="mb-4 text-xs text-muted-2">As recomendações virão como contexto de todo post novo.</p>
        <ol className="space-y-4">
          {diagnostic.actionPlan.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {onCreatePost && (
        <button
          onClick={onCreatePost}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-card hover:opacity-90"
        >
          ✨ Criar post com esse diagnóstico
        </button>
      )}
    </div>
  )
}
