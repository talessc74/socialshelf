import type { TopicSuggestion } from '../entities/TopicSuggestion.js'

export interface TopicSuggestionRepository {
  save(userId: string, suggestion: TopicSuggestion): Promise<void>
  findLatestByBrand(userId: string, brandId: string): Promise<TopicSuggestion[]>
  findById(userId: string, brandId: string, id: string): Promise<TopicSuggestion | null>
}
