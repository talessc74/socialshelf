import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  BrandProfileRepository,
  CampaignItem,
  CampaignItemRepository,
  CampaignPhoto,
  CampaignPhotoRepository,
  CampaignTimelineLockRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
  PostRepository,
} from '@socialshelf/domain'
import { computeScheduledTimes } from './locationClustering.js'
import { ResumeCampaignUseCase } from './ResumeCampaignUseCase.js'

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
    status: 'paused',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date('2026-07-01T00:00:00.000Z'),
    completedAt: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<CampaignItem> = {}): CampaignItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    order: 0,
    photoIds: ['photo-1'],
    caption: 'Legenda',
    scheduledAt: new Date('2026-07-15T09:00:00.000Z'),
    status: 'planned',
    postId: null,
    ...overrides,
  }
}

function makePhoto(overrides: Partial<CampaignPhoto> = {}): CampaignPhoto {
  return {
    id: 'photo-1',
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    storagePath: 'gs://bucket/photo-1.jpg',
    exifTakenAt: null,
    gpsLat: null,
    gpsLng: null,
    locationClusterId: null,
    createdAt: new Date(),
    order: null,
    perceptualHash: null,
    duplicateOfPhotoId: null,
    ...overrides,
  }
}

describe('ResumeCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let itemRepo: CampaignItemRepository
  let photoRepo: CampaignPhotoRepository
  let postRepo: PostRepository
  let brandProfileRepo: BrandProfileRepository
  let lockRepo: CampaignTimelineLockRepository
  let useCase: ResumeCampaignUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
    }
    itemRepo = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn().mockResolvedValue([makeItem()]),
      deleteByCampaign: vi.fn(),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([makePhoto()]),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
      claimForPublishing: vi.fn(),
    }
    brandProfileRepo = {
      save: vi.fn(),
      findLatestByBrand: vi.fn().mockResolvedValue(null),
      findByBrandAndVersion: vi.fn(),
    }
    lockRepo = {
      tryAcquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
    }
    useCase = new ResumeCampaignUseCase(campaignRepo, itemRepo, photoRepo, postRepo, brandProfileRepo, lockRepo)
  })

  it('rejects when the campaign does not exist', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(null)
    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('Campaign not found')
  })

  it.each(['draft', 'reviewing', 'active', 'completed', 'cancelled'] as const)(
    'rejects resuming a campaign that is %s',
    async (status) => {
      vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))
      await expect(
        useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
      ).rejects.toThrow('Only a paused campaign can be resumed')
      expect(campaignRepo.save).not.toHaveBeenCalled()
    },
  )

  it('rejects when another concurrent timeline update already holds the lock', async () => {
    vi.mocked(lockRepo.tryAcquire).mockResolvedValue(false)
    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('already in progress')
    expect(postRepo.save).not.toHaveBeenCalled()
  })

  it('releases the lock after a successful run', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(lockRepo.release).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('re-materializes planned items with new scheduled times computed from now, not from the old plan', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T12:00:00.000Z'))

    try {
      await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

      expect(postRepo.save).toHaveBeenCalledTimes(1)
      const savedPost = vi.mocked(postRepo.save).mock.calls[0]![0]
      expect(savedPost.status).toBe('scheduled')
      expect(savedPost.campaignId).toBe('campaign-1')
      // Mesma conta que ResumeCampaignUseCase faz internamente — a data velha do item ('2026-07-15')
      // não deve sobreviver ao resume.
      const [expectedTime] = computeScheduledTimes(1, 2, new Date())
      expect(savedPost.scheduledAt).toEqual(expectedTime)

      const savedItems = vi.mocked(itemRepo.saveAll).mock.calls[0]![0]
      expect(savedItems[0]!.status).toBe('materialized')
      expect(savedItems[0]!.postId).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not touch items that were already materialized before pausing', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ status: 'materialized', postId: 'post-1' })])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.save).not.toHaveBeenCalled()
    expect(itemRepo.saveAll).not.toHaveBeenCalled()
  })

  it('sets the campaign back to active even when there is nothing pending to reschedule', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([])
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('active')
  })
})
