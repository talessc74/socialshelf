import type { ApiConnection } from './api'
import { PLATFORM_META } from './platformMeta'

/** Mensagem do Selfie para a tela de Contas: quantas redes já estão conectadas de N. */
export function buildAccountsMessage(connections: ApiConnection[]): string {
  const total = Object.keys(PLATFORM_META).length
  const connectedCount = new Set(connections.map((c) => c.platform)).size

  if (connectedCount === 0) return 'Você ainda não conectou nenhuma rede. Bora conectar a primeira?'
  if (connectedCount === total) return `Você já conectou todas as ${total} redes disponíveis!`
  return `Você já conectou ${connectedCount} de ${total} redes.`
}
