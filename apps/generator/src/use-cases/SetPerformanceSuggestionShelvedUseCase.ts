import type { PerformanceSuggestionRepository } from '@socialshelf/domain'

export class SetPerformanceSuggestionShelvedUseCase {
  constructor(private readonly suggestionRepo: PerformanceSuggestionRepository) {}

  async execute(brandId: string, id: string, shelved: boolean): Promise<void> {
    await this.suggestionRepo.setShelved(brandId, id, shelved)
  }
}
