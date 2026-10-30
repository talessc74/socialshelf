import type { ProfileDiagnostic } from './PatternAnalyzerPort.js'

export interface PerformanceSuggestionDraft {
  headline: string
  rationale: string
  viralScore: number
  basedOnThemes: string[]
  bestTimeToPost: string
  bestTimeWeekdays: number[]
  bestTimeHourStart: number
  bestTimeHourEnd: number
}

export interface PerformanceSuggesterPort {
  // userId/brandId: atribuição de custo de IA (Fase 0 de billing) — quem pagou por esta chamada.
  suggestPosts(diagnostic: ProfileDiagnostic, userId: string, brandId: string): Promise<PerformanceSuggestionDraft[]>
}
