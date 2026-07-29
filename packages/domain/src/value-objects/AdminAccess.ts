/**
 * Allowlist de administradores. O produto ainda não tem papéis/claims, então o "usuário
 * admin" é simplesmente um e-mail nesta lista. Compartilhado entre apps/web (esconder UI) e
 * apps/api (autorizar de verdade no backend, ver requireAdmin em apps/api/src/middleware) —
 * uma checagem só no frontend não impede uma chamada direta à API de outra conta autenticada.
 * Comparação sempre em minúsculas.
 */
const ADMIN_EMAILS = ['talessc@me.com']

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
