import type { AiUsageEvent } from '../entities/AiUsageEvent.js'

export interface AiUsageMonthSummary {
  // Formato 'YYYY-MM', mais recente primeiro.
  month: string
  textUsd: number
  imageUsd: number
  totalUsd: number
}

// Agrupa eventos de uso de IA por mês, separando texto de imagem — mesma lógica usada tanto
// pela tela de admin (todas as contas, GetAdminAiUsageSummaryUseCase em apps/api) quanto pela
// tela de gasto da própria conta (GetBrandAiUsageSummaryUseCase), pra nunca divergir entre as
// duas (_local-edr-policy-072, _local-edr-policy-073).
export function groupAiUsageEventsByMonth(events: AiUsageEvent[]): AiUsageMonthSummary[] {
  const byMonth = new Map<string, AiUsageMonthSummary>()
  for (const event of events) {
    const month = event.createdAt.toISOString().slice(0, 7)
    const entry = byMonth.get(month) ?? { month, textUsd: 0, imageUsd: 0, totalUsd: 0 }
    if (event.category === 'text-generation') entry.textUsd += event.estimatedCostUsd
    else entry.imageUsd += event.estimatedCostUsd
    entry.totalUsd += event.estimatedCostUsd
    byMonth.set(month, entry)
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
}
