import type { PerformanceSuggestion, PerformanceSuggestionFeedback } from '../entities/PerformanceSuggestion.js'

export interface PerformanceSuggestionRepository {
  save(suggestion: PerformanceSuggestion): Promise<void>
  findLatestByBrand(brandId: string): Promise<PerformanceSuggestion[]>
  recordFeedback(brandId: string, id: string, feedback: PerformanceSuggestionFeedback): Promise<void>
}
