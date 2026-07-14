import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { PhotoCampaign, PhotoCampaignRepository } from '@socialshelf/domain'
import { CancelCampaignUseCase } from './CancelCampaignUseCase.js'

function makeCampaign(overrides: Partial<PhotoCampaign> = {}): PhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem',
    keywords: [],
    platforms: [Platform.INSTAGRAM],
    postsPerDay: 2,
    carouselSizeDefault: 2,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

describe('CancelCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let useCase: CancelCampaignUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
    }
    useCase = new CancelCampaignUseCase(campaignRepo)
  })

  it('rejects when the campaign does not exist', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(null)
    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('Campaign not found')
  })

  it.each(['draft', 'reviewing'] as const)('cancels a campaign in %s status', async (status) => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('cancelled')
  })

  it.each(['active', 'completed', 'cancelled'] as const)(
    'rejects cancelling a campaign that is already %s',
    async (status) => {
      vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))

      await expect(
        useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
      ).rejects.toThrow('has not started')
      expect(campaignRepo.save).not.toHaveBeenCalled()
    },
  )
})
