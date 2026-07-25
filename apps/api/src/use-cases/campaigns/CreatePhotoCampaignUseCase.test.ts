import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { PhotoCampaignRepository } from '@socialshelf/domain'
import { CreatePhotoCampaignUseCase } from './CreatePhotoCampaignUseCase.js'

describe('CreatePhotoCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let useCase: CreatePhotoCampaignUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findCancelledForPhotoCleanup: vi.fn(),
      delete: vi.fn(),
    }
    useCase = new CreatePhotoCampaignUseCase(campaignRepo)
  })

  const baseInput = {
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem de verão',
    keywords: ['viagem', 'europa'],
    platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
    postsPerDay: 3,
    carouselSizeDefault: 5,
  }

  it('creates a campaign in draft status', async () => {
    const campaign = await useCase.execute(baseInput)
    expect(campaign.status).toBe('draft')
    expect(campaign.name).toBe('Viagem à Europa')
    expect(campaignRepo.save).toHaveBeenCalledTimes(1)
  })

  it('rejects a campaign that includes X (Twitter)', async () => {
    await expect(
      useCase.execute({ ...baseInput, platforms: [Platform.INSTAGRAM, Platform.TWITTER] }),
    ).rejects.toThrow('X does not support image posting')
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('rejects a campaign with no platforms selected', async () => {
    await expect(useCase.execute({ ...baseInput, platforms: [] })).rejects.toThrow('At least one platform')
  })
})
