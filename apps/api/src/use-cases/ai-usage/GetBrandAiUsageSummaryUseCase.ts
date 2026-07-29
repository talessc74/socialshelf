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

  async execute(userId: string, brandId: string): Promise<BrandAiUsageSummary> {
    const events = await this.aiUsageReader.findByBrand(userId, brandId)
    return { months: groupAiUsageEventsByMonth(events) }
  }
}
