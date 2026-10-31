import type { AiUsageEvent } from '../entities/AiUsageEvent.js'

export interface AiUsageMonthSummary {
  // Formato 'YYYY-MM', mais recente primeiro.
  month: string
  textUsd: number
  imageUsd: number
  // audioUsd é custo real (TTS cobrado por caractere); videoUsd é só observabilidade de
  // volume — FfmpegVideoComposer sempre registra estimatedCostUsd: 0 (compute do Cloud Run,
  // não API por unidade, ver AiUsageEvent.ts). Campos separados desde a introdução das
  // categorias 'audio-synthesis'/'video-composition' (_local-adr-policy-0NN, Fase 0) — antes
  // delas, qualquer coisa que não fosse texto caía em imageUsd por ser a única outra categoria
  // que existia.
  audioUsd: number
  videoUsd: number
  totalUsd: number
}

// Agrupa eventos de uso de IA por mês, por categoria — mesma lógica usada tanto pela tela de
// admin (todas as contas, GetAdminAiUsageSummaryUseCase em apps/api) quanto pela tela de gasto
// da própria conta (GetBrandAiUsageSummaryUseCase), pra nunca divergir entre as duas
// (_local-edr-policy-072, _local-edr-policy-073).
export function groupAiUsageEventsByMonth(events: AiUsageEvent[]): AiUsageMonthSummary[] {
  const byMonth = new Map<string, AiUsageMonthSummary>()
  for (const event of events) {
    const month = event.createdAt.toISOString().slice(0, 7)
    const entry = byMonth.get(month) ?? { month, textUsd: 0, imageUsd: 0, audioUsd: 0, videoUsd: 0, totalUsd: 0 }
    switch (event.category) {
      case 'text-generation':
        entry.textUsd += event.estimatedCostUsd
        break
      case 'image-generation':
        entry.imageUsd += event.estimatedCostUsd
        break
      case 'audio-synthesis':
        entry.audioUsd += event.estimatedCostUsd
        break
      case 'video-composition':
        entry.videoUsd += event.estimatedCostUsd
        break
    }
    entry.totalUsd += event.estimatedCostUsd
    byMonth.set(month, entry)
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month))
}
