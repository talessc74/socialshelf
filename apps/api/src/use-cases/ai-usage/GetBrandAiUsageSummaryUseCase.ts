import { groupAiUsageEventsByMonth } from '@socialshelf/domain'
import type { AiUsageReaderPort, AiUsageMonthSummary } from '@socialshelf/domain'

export interface BrandAiUsageSummary {
  months: AiUsageMonthSummary[]
}

// Gasto de IA da própria conta (não de todas — ver GetAdminAiUsageSummaryUseCase para a versão
// admin), agrupado por mês e separado em texto/imagem — mesma agregação da tela de admin, aqui
// escopada a um único brandId (_local-edr-policy-073).
export class GetBrandAiUsageSummaryUseCase {
  constructor(private readonly aiUsageReader: AiUsageReaderPort) {}

  // historyRetentionDays vem do plano do usuário (PlanLimits, _local-adr-policy-0NN) — null
  // significa sem corte (plano legado). Filtra em memória, igual ao resto desta classe: o
  // volume ainda é baixo o suficiente pra não exigir mudar o port nem adicionar índice novo.
  async execute(userId: string, brandId: string, historyRetentionDays: number | null): Promise<BrandAiUsageSummary> {
    const events = await this.aiUsageReader.findByBrand(userId, brandId)
    const filtered =
      historyRetentionDays === null
        ? events
        : events.filter((event) => event.createdAt >= daysAgo(historyRetentionDays))
    return { months: groupAiUsageEventsByMonth(filtered) }
  }
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}
