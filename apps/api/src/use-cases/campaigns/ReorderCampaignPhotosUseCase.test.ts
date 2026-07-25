import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { CampaignPhotoRepository, PhotoCampaign, PhotoCampaignRepository } from '@socialshelf/domain'
import { ReorderCampaignPhotosUseCase } from './ReorderCampaignPhotosUseCase.js'

function makeCampaign(overrides: Partial<PhotoCampaign> = {}): PhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: '',
    keywords: [],
    platforms: [Platform.INSTAGRAM],
    postsPerDay: 2,
    carouselSizeDefault: 5,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    photosDeletedAt: null,
    ...overrides,
  }
}

describe('ReorderCampaignPhotosUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let photoRepo: CampaignPhotoRepository
  let useCase: ReorderCampaignPhotosUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
      findCancelledForPhotoCleanup: vi.fn(),
      delete: vi.fn(),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn(),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn().mockResolvedValue(undefined),
      deleteByCampaign: vi.fn(),
    }
    useCase = new ReorderCampaignPhotosUseCase(campaignRepo, photoRepo)
  })

  const baseInput = { userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1', photoIds: ['p2', 'p1'] }

  it('persists the new order for a draft campaign', async () => {
    await useCase.execute(baseInput)
    expect(photoRepo.reorder).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1', ['p2', 'p1'])
  })

  it('allows reordering while the campaign is in review', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValueOnce(makeCampaign({ status: 'reviewing' }))
    await useCase.execute(baseInput)
    expect(photoRepo.reorder).toHaveBeenCalledTimes(1)
  })

  it('rejects reordering once the campaign is active', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValueOnce(makeCampaign({ status: 'active' }))
    await expect(useCase.execute(baseInput)).rejects.toThrow('Photos can only be reordered')
    expect(photoRepo.reorder).not.toHaveBeenCalled()
  })

  it('throws when the campaign does not exist', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValueOnce(null)
    await expect(useCase.execute(baseInput)).rejects.toThrow('Campaign not found')
  })
})
