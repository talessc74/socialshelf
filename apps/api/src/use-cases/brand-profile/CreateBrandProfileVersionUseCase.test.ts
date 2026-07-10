import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateBrandProfileVersionUseCase } from './CreateBrandProfileVersionUseCase.js'
import type { BrandProfileRepository, BrandProfile } from '@socialshelf/domain'

const sections: Omit<BrandProfile, 'id' | 'userId' | 'brandId' | 'version' | 'createdAt'> = {
  business: { name: 'Radio Kactus', segment: 'Media', description: 'Community radio' },
  identity: { positioning: 'Close to the community', values: ['local', 'honest'] },
  visual: {
    primaryColor: '#ff0055',
    secondaryColor: '#0a0a0a',
    typography: 'Inter',
    logoStoragePath: null,
  },
  voice: { tone: 'informal', allowedVocabulary: ['galera'], prohibitedVocabulary: ['sarcasmo'] },
  narrative: { recurringThemes: ['cultura local'] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: ['política'], maxAutoPostsPerDay: 1 },
}

describe('CreateBrandProfileVersionUseCase', () => {
  let brandProfileRepo: BrandProfileRepository
  let useCase: CreateBrandProfileVersionUseCase

  beforeEach(() => {
    brandProfileRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findLatestByBrand: vi.fn().mockResolvedValue(null),
      findByBrandAndVersion: vi.fn(),
    }
    useCase = new CreateBrandProfileVersionUseCase(brandProfileRepo)
  })

  it('creates version 1 when no prior brand profile exists', async () => {
    const profile = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', ...sections })

    expect(profile.version).toBe(1)
  })

  it('increments the version from the latest existing brand profile', async () => {
    vi.mocked(brandProfileRepo.findLatestByBrand).mockResolvedValue({
      id: 'profile-1',
      userId: 'user-1',
      brandId: 'brand-1',
      version: 4,
      createdAt: new Date(),
      ...sections,
    })

    const profile = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', ...sections })

    expect(profile.version).toBe(5)
  })

  it('persists the new version via the repository', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', ...sections })

    expect(brandProfileRepo.save).toHaveBeenCalledTimes(1)
  })

  it('never overwrites a prior version — save receives a new id each time', async () => {
    const first = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', ...sections })

    vi.mocked(brandProfileRepo.findLatestByBrand).mockResolvedValue(first)
    const second = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', ...sections })

    expect(second.id).not.toBe(first.id)
    expect(second.version).toBe(first.version + 1)
  })

  it('carries operation.autonomyLevel through unchanged', async () => {
    const profile = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', ...sections })

    expect(profile.operation.autonomyLevel).toBe('manual')
  })
})
