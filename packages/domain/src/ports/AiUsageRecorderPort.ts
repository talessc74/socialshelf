import type { AiUsageCategory } from '../entities/AiUsageEvent.js'

export interface NewAiUsageEvent {
  userId: string
  brandId: string
  category: AiUsageCategory
  operation: string
  model: string
  promptTokenCount?: number | undefined
  candidatesTokenCount?: number | undefined
  thoughtsTokenCount?: number | undefined
  imageCount?: number | undefined
  estimatedCostUsd: number
}

// Implementações NUNCA devem rejeitar/lançar — medir uso é observabilidade, não deve derrubar
// uma geração de conteúdo real por falha de gravação. Ver FirestoreAiUsageRepository.
export interface AiUsageRecorderPort {
  record(event: NewAiUsageEvent): Promise<void>
}
