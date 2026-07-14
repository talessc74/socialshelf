import { describe, it, expect } from 'vitest'
import { buildComposeReminder } from './selfieComposeReminder'
import type { ApiBrandProfile } from './api'

function makeProfile(overrides: Partial<ApiBrandProfile> = {}): ApiBrandProfile {
  return {
    id: 'bp-1',
    userId: 'user-1',
    brandId: 'brand-1',
    version: 1,
    business: { name: 'EAI? Jurídico', segment: 'LegalTech', description: '' },
    identity: { positioning: '', values: [] },
    visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
    voice: { tone: 'direto e didático', allowedVocabulary: [], prohibitedVocabulary: [] },
    narrative: { recurringThemes: [] },
    operation: {
      autonomyLevel: 'manual',
      autoPublishTopics: [],
      blockedTopics: [],
      maxAutoPostsPerDay: 1,
      stylePreferences: [],
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ApiBrandProfile
}

describe('buildComposeReminder', () => {
  it('retorna null sem BrandProfile', () => {
    expect(buildComposeReminder(null)).toBeNull()
  })

  it('retorna null quando o tom de voz não está configurado', () => {
    expect(buildComposeReminder(makeProfile({ voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] } }))).toBeNull()
  })

  it('lembra o tom de voz configurado, citando o nome da marca', () => {
    const message = buildComposeReminder(makeProfile())
    expect(message).toContain('EAI? Jurídico')
    expect(message).toContain('direto e didático')
  })
})
