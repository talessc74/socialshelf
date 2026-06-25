import type { PerformanceSuggestion, PerformanceSuggestionFeedback } from '../entities/PerformanceSuggestion.js'

export interface PerformanceSuggestionRepository {
  save(userId: string, suggestion: PerformanceSuggestion): Promise<void>
  findLatestByBrand(userId: string, brandId: string): Promise<PerformanceSuggestion[]>
  recordFeedback(userId: string, brandId: string, id: string, feedback: PerformanceSuggestionFeedback): Promise<void>
  setShelved(userId: string, brandId: string, id: string, shelved: boolean): Promise<void>
  findShelvedByBrand(userId: string, brandId: string): Promise<PerformanceSuggestion[]>
}
