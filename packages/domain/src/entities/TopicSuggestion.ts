export interface TopicSuggestion {
  id: string
  brandId: string
  headline: string
  summary: string
  sourceUrl: string
  sourceDomain: string
  rationale: string
  audienceFitScore: number
  // Imagem de capa (og:image do artigo, melhor esforço). null quando o veículo não expõe imagem —
  // o carrossel cai num placeholder visual nesses casos.
  thumbnailUrl: string | null
  createdAt: Date
}
