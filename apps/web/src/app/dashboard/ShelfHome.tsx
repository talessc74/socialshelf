'use client'

import { BookOpen } from 'lucide-react'
import { useViewMode } from '../../contexts/ViewModeContext'

/**
 * Placeholder da nova entrada 'shelf' (Fase 0 do rollout). Ainda não é a
 * prateleira 3D / flip clock — é só a casca que prova o interruptor ponta a
 * ponta. Só administradores chegam aqui (o seletor em page.tsx garante isso),
 * então este aviso de "em construção" nunca aparece para o público.
 *
 * As Fases seguintes substituem este componente pela prateleira (desktop) e
 * pelo flip clock (mobile), ligando cada capa nas rotas reais já existentes.
 */
export function ShelfHome() {
  const { setViewMode } = useViewMode()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <BookOpen className="h-8 w-8" />
      </span>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Prévia de administrador</p>
        <h1 className="text-2xl font-bold text-ink">A prateleira está em construção</h1>
      </div>
      <p className="max-w-md text-sm text-muted">
        O interruptor de visual está funcionando — esta é a nova entrada <code className="rounded bg-card-2 px-1.5 py-0.5 text-xs">shelf</code>.
        A prateleira 3D (desktop) e o flip clock (mobile) entram nas próximas fases, com cada capa
        ligando nas telas reais que já existem hoje. Nada disso aparece para os usuários: o novo visual
        sobe desligado por padrão.
      </p>
      <button
        type="button"
        onClick={() => setViewMode('classic')}
        className="rounded-full bg-contrast px-5 py-2 text-sm font-semibold text-contrast-ink hover:opacity-90"
      >
        Voltar ao visual clássico
      </button>
    </div>
  )
}
