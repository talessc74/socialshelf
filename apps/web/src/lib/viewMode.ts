/**
 * Interruptor de visual da /dashboard: alterna entre a home atual ('classic')
 * e a nova prateleira/flip clock ('shelf'). Ver _local-bdr-policy-010 (seção
 * "Atualização — Redesign da entrada /dashboard").
 *
 * Fase 0 do rollout: o novo visual entra desligado por padrão e o interruptor
 * só aparece para administradores — eles testam 'shelf' em produção sem expor
 * a ninguém. A preferência é gravada por usuário no localStorage (decisão
 * técnica do MVP; um dia migra para o doc do usuário no Firestore).
 */

export type ViewMode = 'classic' | 'shelf'

export const DEFAULT_VIEW_MODE: ViewMode = 'classic'

/**
 * Allowlist de administradores. O produto ainda não tem papéis/claims, então
 * o "usuário admin" é simplesmente um e-mail nesta lista — quem enxerga o
 * interruptor antes do lançamento público. Comparação sempre em minúsculas.
 */
const ADMIN_EMAILS = ['talessc@me.com']

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}

function storageKey(userId: string): string {
  return `socialshelf:viewMode:${userId}`
}

/** Lê a preferência gravada; cai no padrão ('classic') fora do browser ou sem valor. */
export function readViewMode(userId: string | null | undefined): ViewMode {
  if (!userId || typeof window === 'undefined') return DEFAULT_VIEW_MODE
  return window.localStorage.getItem(storageKey(userId)) === 'shelf' ? 'shelf' : DEFAULT_VIEW_MODE
}

/** Grava a preferência do usuário. No-op fora do browser. */
export function writeViewMode(userId: string, mode: ViewMode): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(userId), mode)
}
