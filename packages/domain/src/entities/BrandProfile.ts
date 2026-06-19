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
