import { describe, it, expect } from 'vitest'
import { buildBrandMessage } from './selfieBrandCompleteness'
import type { ApiBrandProfile } from './api'

function makeProfile(overrides: Partial<ApiBrandProfile> = {}): ApiBrandProfile {
  return {
    id: 'bp-1',
    userId: 'user-1',
    brandId: 'brand-1',
    version: 1,
    business: { name: 'EAI? Jurídico', segment: 'LegalTech', description: '' },
    identity: { positioning: 'Direito acessível', values: [] },
    visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: 'logo.png' },
    voice: { tone: 'direto e didático', allowedVocabulary: [], prohibitedVocabulary: [] },
    narrative: { recurringThemes: ['tecnologia jurídica'] },
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

describe('buildBrandMessage', () => {
  it('retorna null sem BrandProfile', () => {
    expect(buildBrandMessage(null)).toBeNull()
  })

  it('comemora quando todos os campos-chave estão preenchidos', () => {
    expect(buildBrandMessage(makeProfile())).toContain('perfil completo')
  })

  it('aponta quantos campos-chave faltam', () => {
    const incomplete = makeProfile({
      business: { name: '', segment: '', description: '' },
      voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
    })
    const message = buildBrandMessage(incomplete)
    expect(message).toContain('3/6')
  })
})
