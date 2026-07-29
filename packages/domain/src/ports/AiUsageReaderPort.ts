import type { AiUsageEvent } from '../entities/AiUsageEvent.js'

export interface AiUsageReaderPort {
  // Todos os eventos, de todas as contas — só para a tela de admin de gastos
  // (_local-edr-policy-072). Nunca usar num caminho acessível a um usuário comum.
  findAll(): Promise<AiUsageEvent[]>
  // Eventos de uma única marca — acessível pelo próprio dono da marca (tela de gasto da conta,
  // _local-edr-policy-073). O volume ainda é baixo o suficiente para agregar por mês em memória
  // no use-case, sem exigir paginação ou índice extra além do já usado pela escrita
  // (AiUsageRecorderPort).
  findByBrand(userId: string, brandId: string): Promise<AiUsageEvent[]>
}
