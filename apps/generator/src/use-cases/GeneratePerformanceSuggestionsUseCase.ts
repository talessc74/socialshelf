import { randomUUID } from 'node:crypto'
import type {
  PerformanceSuggesterPort,
  PerformanceSuggestionRepository,
  PerformanceSuggestion,
  ProfileDiagnostic,
} from '@socialshelf/domain'

export class GeneratePerformanceSuggestionsUseCase {
  constructor(
    private readonly suggester: PerformanceSuggesterPort,
    private readonly suggestionRepo: PerformanceSuggestionRepository,
  ) {}

  async execute(brandId: string, diagnostic: ProfileDiagnostic): Promise<PerformanceSuggestion[]> {
    const drafts = await this.suggester.suggestPosts(diagnostic)

    const suggestions: PerformanceSuggestion[] = drafts.map((draft) => ({
      id: randomUUID(),
      brandId,
      headline: draft.headline,
      rationale: draft.rationale,
      viralScore: draft.viralScore,
      basedOnThemes: draft.basedOnThemes,
      feedback: null,
      createdAt: new Date(),
    }))

    for (const suggestion of suggestions) {
      await this.suggestionRepo.save(suggestion)
    }

    return suggestions
  }
}
