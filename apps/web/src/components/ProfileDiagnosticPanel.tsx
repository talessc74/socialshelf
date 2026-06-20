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
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Posts analisados</p>
          <p className="text-2xl font-bold text-gray-900">{postsAnalyzed}</p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Potencial viral</p>
          <p className="text-2xl font-bold text-gray-900">{diagnostic.viralPotential} de 100</p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Melhor janela</p>
          <p className="text-2xl font-bold text-gray-900">{diagnostic.bestTimes[0] ?? '—'}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
          Nicho detectado pelos dados
        </p>
        <h3 className="mb-2 text-xl font-bold text-gray-900">{diagnostic.niche}</h3>
        <p className="text-sm text-gray-700">{diagnostic.diagnosisSummary}</p>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">O que já funciona</h3>
        <ul className="space-y-3">
          {diagnostic.whatWorks.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs text-brand-700">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-brand-100 bg-white p-6 text-center shadow-sm shadow-brand-100/60">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-brand-100">
          <span className="text-3xl font-bold text-brand-700">{diagnostic.viralPotential}</span>
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Potencial viral do seu perfil hoje
        </p>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Temas que engajam</h3>
        <ul className="space-y-3">
          {diagnostic.engagingThemes.map((theme, i) => (
            <li key={i}>
              <p className="mb-1 text-sm font-medium text-gray-800">{theme.label}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${theme.strength}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Formatos que performam</h3>
          <div className="flex flex-wrap gap-1.5">
            {diagnostic.topFormats.map((format) => (
              <span
                key={format}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Melhores horários</h3>
          <div className="flex flex-wrap gap-1.5">
            {diagnostic.bestTimes.map((time) => (
              <span
                key={time}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
              >
                {time}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Engajamento</h3>
        <p className="text-sm text-gray-700">{diagnostic.engagementAnalysis}</p>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">Plano de ação</h3>
        <p className="mb-4 text-xs text-gray-400">As recomendações virão como contexto de todo post novo.</p>
        <ol className="space-y-4">
          {diagnostic.actionPlan.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {onCreatePost && (
        <button
          onClick={onCreatePost}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-200 hover:bg-brand-700"
        >
          ✨ Criar post com esse diagnóstico
        </button>
      )}
    </div>
  )
}
