export interface BrandProfileBusiness {
  name: string
  segment: string
  description: string
}

export interface BrandProfileIdentity {
  positioning: string
  values: string[]
}

export interface BrandProfileVisual {
  primaryColor: string
  secondaryColor: string
  typography: string
  logoStoragePath: string | null
}

export interface BrandProfileVoice {
  tone: string
  allowedVocabulary: string[]
  prohibitedVocabulary: string[]
}

export interface BrandProfileNarrative {
  recurringThemes: string[]
}

export type AutonomyLevel = 'manual' | 'semi-automatic' | 'automatic'

export interface BrandProfileOperation {
  autonomyLevel: AutonomyLevel
  autoPublishTopics: string[]
  blockedTopics: string[]
  // Teto diário de posts que o modo automático pode gerar e publicar sozinho, por marca —
  // guardrail obrigatório antes de ativar publicação autônoma (_local-bdr-plan-002, Fase 4).
  // Só é imposto de fato quando autonomyLevel é 'automatic'; nos demais níveis o campo
  // existe mas não é lido por nenhuma verificação.
  maxAutoPostsPerDay: number
}

export interface BrandProfile {
  id: string
  userId: string
  brandId: string
  version: number
  business: BrandProfileBusiness
  identity: BrandProfileIdentity
  visual: BrandProfileVisual
  voice: BrandProfileVoice
  narrative: BrandProfileNarrative
  operation: BrandProfileOperation
  createdAt: Date
}
