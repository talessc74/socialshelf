export type PerformanceSuggestionFeedback = 'helpful' | 'not_helpful'

export interface PerformanceSuggestion {
  id: string
  brandId: string
  headline: string
  rationale: string
  viralScore: number
  basedOnThemes: string[]
  feedback: PerformanceSuggestionFeedback | null
  bestTimeToPost: string
  bestTimeWeekdays: number[]
  bestTimeHourStart: number
  bestTimeHourEnd: number
  shelved: boolean
  createdAt: Date
}
