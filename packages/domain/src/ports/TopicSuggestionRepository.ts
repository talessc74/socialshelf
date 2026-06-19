import type { TopicSuggestion } from '../entities/TopicSuggestion.js'

export interface TopicSuggestionRepository {
  save(suggestion: TopicSuggestion): Promise<void>
  findLatestByBrand(brandId: string): Promise<TopicSuggestion[]>
  findById(brandId: string, id: string): Promise<TopicSuggestion | null>
}
