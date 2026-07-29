import { groupAiUsageEventsByMonth } from '@socialshelf/domain'
import type { AiUsageReaderPort, BrandRepository, AiUsageEvent, AiUsageMonthSummary } from '@socialshelf/domain'

export interface AdminAiUsageBrandSummary {
  brandId: string
  brandName: string
  months: AiUsageMonthSummary[]
}

export interface AdminAiUsageSummary {
  brands: AdminAiUsageBrandSummary[]
}

// Agrega os eventos de uso de IA (gravados por brand pelo generator-service) por marca e por
// mês, separando texto de imagem — a mesma separação por fase pedida pelo usuário para a
// mensuração. Junta com BrandRepository só para trocar o brandId cru por um nome legível na
// tela (_local-edr-policy-072). Marcas sem nenhum evento ainda aparecem na lista, com months: [].
export class GetAdminAiUsageSummaryUseCase {
  constructor(
    private readonly aiUsageReader: AiUsageReaderPort,
    private readonly brandRepo: BrandRepository,
  ) {}

  async execute(): Promise<AdminAiUsageSummary> {
    const [brands, events] = await Promise.all([this.brandRepo.findAll(), this.aiUsageReader.findAll()])

    const eventsByBrand = new Map<string, AiUsageEvent[]>()
    for (const event of events) {
      const list = eventsByBrand.get(event.brandId) ?? []
      list.push(event)
      eventsByBrand.set(event.brandId, list)
    }

    const brandSummaries = brands.map((brand) => ({
      brandId: brand.id,
      brandName: brand.name,
      months: groupAiUsageEventsByMonth(eventsByBrand.get(brand.id) ?? []),
    }))

    brandSummaries.sort((a, b) => a.brandName.localeCompare(b.brandName))

    return { brands: brandSummaries }
  }
}
