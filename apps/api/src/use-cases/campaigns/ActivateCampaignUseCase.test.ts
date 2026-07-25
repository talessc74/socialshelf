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
import { ActivateCampaignUseCase } from './ActivateCampaignUseCase.js'

function makeCampaign(overrides: Partial<PhotoCampaign> = {}): PhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem',
    keywords: [],
    platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
    postsPerDay: 2,
    carouselSizeDefault: 2,
    status: 'reviewing',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    photosDeletedAt: null,
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
    aspectRatio: null,
    unsupportedAspectRatio: false,
    ...overrides,
  }
}

describe('ActivateCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let itemRepo: CampaignItemRepository
  let photoRepo: CampaignPhotoRepository
  let postRepo: PostRepository
  let brandProfileRepo: BrandProfileRepository
  let lockRepo: CampaignTimelineLockRepository
  let useCase: ActivateCampaignUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
      findCancelledForPhotoCleanup: vi.fn(),
      delete: vi.fn(),
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
      deleteByCampaign: vi.fn(),
    }
    postRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
      claimForPublishing: vi.fn(),
      findPublishedForImageCleanup: vi.fn(),
      findSavedForLaterByBrand: vi.fn(),
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
    useCase = new ActivateCampaignUseCase(campaignRepo, itemRepo, photoRepo, postRepo, brandProfileRepo, lockRepo)
  })

  it('rejects activating a campaign that is not in reviewing status', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status: 'draft' }))
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'in review',
    )
  })

  it('rejects when another concurrent update already holds the timeline lock', async () => {
    vi.mocked(lockRepo.tryAcquire).mockResolvedValue(false)
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'already in progress',
    )
    expect(postRepo.save).not.toHaveBeenCalled()
  })

  it('releases the timeline lock after a successful run', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(lockRepo.tryAcquire).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
    expect(lockRepo.release).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('releases the timeline lock even when the rest of the execution fails', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([])
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow()
    expect(lockRepo.release).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('rejects activating a campaign with no timeline', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([])
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'no timeline',
    )
  })

  it('materializes a Post with origin campaign and the item scheduledAt', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.save).toHaveBeenCalledTimes(1)
    const savedPost = vi.mocked(postRepo.save).mock.calls[0]![0]
    expect(savedPost.origin).toBe('campaign')
    expect(savedPost.campaignId).toBe('campaign-1')
    expect(savedPost.status).toBe('scheduled')
    expect(savedPost.scheduledAt).toEqual(new Date('2026-07-15T09:00:00.000Z'))
    expect(savedPost.imageStoragePaths).toEqual(['gs://bucket/photo-1.jpg'])
    expect(savedPost.content.map((c) => c.platform)).toEqual([Platform.INSTAGRAM, Platform.FACEBOOK])
  })

  it('marks the item as materialized with the new postId', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const savedItems = vi.mocked(itemRepo.saveAll).mock.calls[0]![0]
    expect(savedItems[0]!.status).toBe('materialized')
    expect(savedItems[0]!.postId).toBeTruthy()
  })

  it('does not re-materialize an item that was already materialized', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ status: 'materialized', postId: 'existing-post' })])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.save).not.toHaveBeenCalled()
  })

  it('sets the campaign to active with a startedAt timestamp', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('active')
    expect(savedCampaign.startedAt).toBeInstanceOf(Date)
  })
})
