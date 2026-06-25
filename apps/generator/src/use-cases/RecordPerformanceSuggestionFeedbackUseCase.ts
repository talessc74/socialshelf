import type { PerformanceSuggestionRepository, PerformanceSuggestionFeedback } from '@socialshelf/domain'

export class RecordPerformanceSuggestionFeedbackUseCase {
  constructor(private readonly suggestionRepo: PerformanceSuggestionRepository) {}

  async execute(brandId: string, id: string, feedback: PerformanceSuggestionFeedback): Promise<void> {
    await this.suggestionRepo.recordFeedback(brandId, brandId, id, feedback)
  }
}
