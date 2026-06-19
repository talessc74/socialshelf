export interface TopicSuggestion {
  id: string
  brandId: string
  headline: string
  summary: string
  sourceUrl: string
  sourceDomain: string
  rationale: string
  audienceFitScore: number
  createdAt: Date
}
