import type { BrandProfileBusiness } from '../entities/BrandProfile.js'

export interface AudienceFitScorerItem {
  headline: string
  summary: string
}

export interface AudienceFitScorerInput {
  business: BrandProfileBusiness
  recurringThemes: string[]
  items: AudienceFitScorerItem[]
}

export interface AudienceFitResult {
  // Subconjunto de recurringThemes (texto exatamente como cadastrado) que a notícia realmente toca.
  matchedThemes: string[]
  // 0 a 3: relevância da notícia para o negócio da marca, avaliada semanticamente — não exige que
  // a notícia cite literalmente um tema recorrente para pontuar (ex.: "IA vence causa no Reino
  // Unido" é relevante para uma LegalTech de IA mesmo sem casar nenhuma palavra do cadastro).
  relevanceStrength: number
}

export interface AudienceFitScorerPort {
  score(input: AudienceFitScorerInput): Promise<AudienceFitResult[]>
}
