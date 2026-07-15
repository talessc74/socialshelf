import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  BrandProfileRepository,
  CampaignItem,
  CampaignItemRepository,
  CampaignPhoto,
  CampaignPhotoRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
  PostRepository,
} from '@socialshelf/domain'
import { ExtendCampaignTimelineUseCase } from './ExtendCampaignTimelineUseCase.js'
import type { CampaignCaptionClient } from '../../infrastructure/generator/CampaignCaptionClient.js'

function makeCampaign(overrides: Partial<PhotoCampaign> = {}): PhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem',
    keywords: ['viagem'],
    platforms: [Platform.INSTAGRAM],
    postsPerDay: 2,
    carouselSizeDefault: 2,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date('2026-07-10T09:00:00.000Z'),
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
    photoIds: ['p1'],
    caption: 'Legenda',
    scheduledAt: new Date('2026-07-15T09:00:00.000Z'),
    status: 'materialized',
    postId: 'post-1',
    ...overrides,
  }
}

function makePhoto(overrides: Partial<CampaignPhoto> = {}): CampaignPhoto {
  return {
    id: 'p1',
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    storagePath: 'gs://bucket/p1.jpg',
    exifTakenAt: null,
    gpsLat: null,
    gpsLng: null,
    locationClusterId: null,
    createdAt: new Date(),
    order: null,
    ...overrides,
  }
}

describe('ExtendCampaignTimelineUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let photoRepo: CampaignPhotoRepository
  let itemRepo: CampaignItemRepository
  let postRepo: PostRepository
  let brandProfileRepo: BrandProfileRepository
  let captionClient: CampaignCaptionClient
  let useCase: ExtendCampaignTimelineUseCase

  beforeEach(() => {
    captionClient = { suggestCaption: vi.fn().mockResolvedValue({ caption: 'Legenda escrita pela IA' }) }
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([makePhoto({ id: 'p1' }), makePhoto({ id: 'p2' })]),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    itemRepo = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn().mockResolvedValue([makeItem({ photoIds: ['p1'] })]),
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
    }
    brandProfileRepo = {
      save: vi.fn(),
      findLatestByBrand: vi.fn().mockResolvedValue(null),
      findByBrandAndVersion: vi.fn(),
    }
    useCase = new ExtendCampaignTimelineUseCase(campaignRepo, photoRepo, itemRepo, postRepo, brandProfileRepo, captionClient)
  })

  it('rejects extending a draft campaign (no timeline exists yet)', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status: 'draft' }))
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'reviewing or active',
    )
  })

  it('rejects extending a cancelled campaign', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status: 'cancelled' }))
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'reviewing or active',
    )
  })

  it('throws when every uploaded photo is already scheduled in an existing item', async () => {
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'p1' })])
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'No new photos',
    )
  })

  it('only schedules photos not yet referenced by any existing item', async () => {
    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(items).toHaveLength(1)
    expect(items[0]!.photoIds).toEqual(['p2'])
  })

  it('never touches the existing items — only appends', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(itemRepo.deleteByCampaign).not.toHaveBeenCalled()
    const saved = vi.mocked(itemRepo.saveAll).mock.calls[0]![0]
    expect(saved).toHaveLength(1)
    expect(saved[0]!.id).not.toBe('item-1')
  })

  it('continues the order sequence after the highest existing item order', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ order: 4, photoIds: ['p1'] })])
    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(items[0]!.order).toBe(5)
  })

  it('schedules the new item the day after the last existing scheduledAt', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([
      makeItem({ scheduledAt: new Date('2026-07-15T09:00:00.000Z'), photoIds: ['p1'] }),
    ])
    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(items[0]!.scheduledAt.toISOString().slice(0, 10)).toBe('2026-07-16')
  })

  it('materializes the new item into a real scheduled Post when the campaign is active', async () => {
    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.save).toHaveBeenCalledTimes(1)
    const savedPost = vi.mocked(postRepo.save).mock.calls[0]![0]
    expect(savedPost.origin).toBe('campaign')
    expect(savedPost.campaignId).toBe('campaign-1')
    expect(savedPost.status).toBe('scheduled')
    expect(items[0]!.status).toBe('materialized')
    expect(items[0]!.postId).toBeTruthy()
  })

  it('leaves new items as planned (no Post created) when the campaign is still reviewing', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status: 'reviewing' }))

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.save).not.toHaveBeenCalled()
    expect(items[0]!.status).toBe('planned')
    expect(items[0]!.postId).toBeNull()
  })

  it('does not change the campaign status, only updatedAt', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('active')
  })
})
