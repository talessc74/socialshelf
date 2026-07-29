import type { AiUsageEvent } from '../entities/AiUsageEvent.js'

// Leitura de todos os eventos de uso de IA, de todas as contas — só para a tela de admin de
// gastos (_local-edr-policy-072). O volume ainda é baixo o suficiente para agregar por
// brand/mês em memória no use-case, sem exigir paginação ou índice extra além do já usado
// pela escrita (AiUsageRecorderPort). Nunca usar num caminho acessível a um usuário comum.
export interface AiUsageReaderPort {
  findAll(): Promise<AiUsageEvent[]>
}
