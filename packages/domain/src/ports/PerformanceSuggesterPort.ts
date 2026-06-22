import type { ProfileDiagnostic } from './PatternAnalyzerPort.js'

export interface PerformanceSuggestionDraft {
  headline: string
  rationale: string
  viralScore: number
  basedOnThemes: string[]
}

export interface PerformanceSuggesterPort {
  suggestPosts(diagnostic: ProfileDiagnostic): Promise<PerformanceSuggestionDraft[]>
}
