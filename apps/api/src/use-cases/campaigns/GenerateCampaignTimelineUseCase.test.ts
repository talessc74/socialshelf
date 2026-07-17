import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  CampaignItemRepository,
  CampaignPhoto,
  CampaignPhotoRepository,
  CampaignTimelineLockRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
} from '@socialshelf/domain'
import { GenerateCampaignTimelineUseCase } from './GenerateCampaignTimelineUseCase.js'
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
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function makePhoto(overrides: Partial<CampaignPhoto> = {}): CampaignPhoto {
  return {
    id: 'photo-1',
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    storagePath: 'path.jpg',
    exifTakenAt: null,
    gpsLat: null,
    gpsLng: null,
    locationClusterId: null,
    createdAt: new Date(),
    order: null,
    ...overrides,
  }
}

describe('GenerateCampaignTimelineUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let photoRepo: CampaignPhotoRepository
  let itemRepo: CampaignItemRepository
  let captionClient: CampaignCaptionClient
  let lockRepo: CampaignTimelineLockRepository
  let useCase: GenerateCampaignTimelineUseCase

  beforeEach(() => {
    captionClient = { suggestCaption: vi.fn().mockResolvedValue({ caption: 'Legenda escrita pela IA a partir da foto' }) }
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([makePhoto({ id: 'p1' }), makePhoto({ id: 'p2' }), makePhoto({ id: 'p3' })]),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    itemRepo = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn(),
      deleteByCampaign: vi.fn().mockResolvedValue(undefined),
    }
    lockRepo = {
      tryAcquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
    }
    useCase = new GenerateCampaignTimelineUseCase(campaignRepo, photoRepo, itemRepo, captionClient, lockRepo)
  })

  it('throws when the campaign has no photos', async () => {
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([])
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'no photos',
    )
  })

  it('rejects regenerating the timeline of an active campaign (would wipe materialized items)', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status: 'active' }))
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'draft or reviewing',
    )
    expect(itemRepo.deleteByCampaign).not.toHaveBeenCalled()
  })

  it('rejects when another concurrent update already holds the timeline lock', async () => {
    vi.mocked(lockRepo.tryAcquire).mockResolvedValue(false)
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow(
      'already in progress',
    )
    expect(itemRepo.deleteByCampaign).not.toHaveBeenCalled()
    expect(itemRepo.saveAll).not.toHaveBeenCalled()
  })

  it('releases the timeline lock even when the rest of the execution fails', async () => {
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([])
    await expect(useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })).rejects.toThrow()
    expect(lockRepo.release).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('releases the timeline lock after a successful run', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(lockRepo.tryAcquire).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
    expect(lockRepo.release).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('groups photos into carousels of carouselSizeDefault within a cluster', async () => {
    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(items).toHaveLength(2)
    expect(items[0]!.photoIds).toEqual(['p1', 'p2'])
    expect(items[1]!.photoIds).toEqual(['p3'])
  })

  it('caps the carousel size to the smallest platform cap even if the campaign default is larger', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(
      makeCampaign({ platforms: [Platform.LINKEDIN], carouselSizeDefault: 50 }),
    )
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => makePhoto({ id: `p${i}` })),
    )

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(items[0]!.photoIds).toHaveLength(20)
  })

  it('persists items and moves the campaign to reviewing', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(itemRepo.deleteByCampaign).toHaveBeenCalledWith('campaign-1')
    expect(itemRepo.saveAll).toHaveBeenCalledTimes(1)
    expect(campaignRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'reviewing' }))
  })

  it('writes each item caption via AI, looking at that item cover photo', async () => {
    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(items[0]!.caption).toBe('Legenda escrita pela IA a partir da foto')
    expect(captionClient.suggestCaption).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', brandId: 'brand-1', storagePath: 'path.jpg' }),
    )
  })

  it('falls back to the deterministic template caption when the AI caption call fails', async () => {
    vi.mocked(captionClient.suggestCaption).mockRejectedValueOnce(new Error('generator-service unavailable'))

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(items[0]!.caption).toContain('Fotos da viagem')
    expect(items[0]!.caption).toContain('#viagem')
  })

  it('writes captions for all items in parallel, isolating one item failure from the rest', async () => {
    vi.mocked(captionClient.suggestCaption)
      .mockResolvedValueOnce({ caption: 'Legenda do item 1' })
      .mockRejectedValueOnce(new Error('generator-service unavailable'))

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(items[0]!.caption).toBe('Legenda do item 1')
    expect(items[1]!.caption).toContain('Fotos da viagem')
  })
})
