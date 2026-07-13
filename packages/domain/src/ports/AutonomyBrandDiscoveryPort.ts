import type { AutonomyLevel } from '../entities/BrandProfile.js'
import type { TemplateStyle } from '../entities/TemplateStyle.js'

export interface AutonomyEligibleBrand {
  userId: string
  brandId: string
  // Sempre 'semi-automatic' ou 'automatic' — brands com autonomyLevel 'manual' nunca são
  // retornadas por findEligibleBrands().
  autonomyLevel: AutonomyLevel
  autoPublishTopics: string[]
  blockedTopics: string[]
  maxAutoPostsPerDay: number
  stylePreferences: TemplateStyle[]
}

// Porta dedicada (em vez de estender BrandProfileRepository) porque só o publisher-service
// precisa descobrir marcas através de todos os usuários para o tick de autonomia — os demais
// adapters de BrandProfileRepository (api, generator) sempre operam com userId/brandId já
// conhecidos e nunca precisariam implementar essa varredura global.
export interface AutonomyBrandDiscoveryPort {
  findEligibleBrands(): Promise<AutonomyEligibleBrand[]>
}
