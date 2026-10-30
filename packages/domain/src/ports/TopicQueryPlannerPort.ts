import type { BrandProfileBusiness } from '../entities/BrandProfile.js'

export interface TopicQueryPlannerInput {
  business: BrandProfileBusiness
  recurringThemes: string[]
  // Atribuição de custo de IA (Fase 0 de billing) — quem pagou por esta chamada.
  userId: string
  brandId: string
}

/**
 * Deriva, a partir do negócio da marca, um conjunto de termos de busca de notícias mais amplo
 * do que o segmento literal — ex.: uma LegalTech também deve buscar IA e tecnologia, não só
 * notícias jurídicas. Isso amplia a chance de encontrar conteúdo com potencial viral para a marca.
 */
export interface TopicQueryPlannerPort {
  planQueries(input: TopicQueryPlannerInput): Promise<string[]>
}
