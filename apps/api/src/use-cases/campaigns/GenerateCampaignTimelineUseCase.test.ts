import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  Brand,
  BrandRepository,
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
    photosDeletedAt: null,
    ...overrides,
  }
}

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: 'brand-1',
    userId: 'user-1',
    name: 'Marca',
    slug: 'marca',
    platforms: [],
    accountType: 'professional',
    createdAt: new Date(),
    updatedAt: new Date(),
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
    perceptualHash: null,
    duplicateOfPhotoId: null,
    aspectRatio: null,
    unsupportedAspectRatio: false,
    ...overrides,
  }
}

describe('GenerateCampaignTimelineUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let photoRepo: CampaignPhotoRepository
  let itemRepo: CampaignItemRepository
  let captionClient: CampaignCaptionClient
  let lockRepo: CampaignTimelineLockRepository
  let brandRepo: BrandRepository
  let useCase: GenerateCampaignTimelineUseCase

  beforeEach(() => {
    captionClient = { suggestCaption: vi.fn().mockResolvedValue({ caption: 'Legenda escrita pela IA a partir da foto' }) }
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
      findCancelledForPhotoCleanup: vi.fn(),
      delete: vi.fn(),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([makePhoto({ id: 'p1' }), makePhoto({ id: 'p2' }), makePhoto({ id: 'p3' })]),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
      deleteByCampaign: vi.fn(),
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
    brandRepo = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeBrand()),
      findByUserId: vi.fn(),
      delete: vi.fn(),
      findAll: vi.fn(),
    }
    useCase = new GenerateCampaignTimelineUseCase(campaignRepo, photoRepo, itemRepo, captionClient, lockRepo, brandRepo)
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

  it('threads the brand accountType and the cover photo EXIF metadata into the caption request', async () => {
    vi.mocked(brandRepo.findById).mockResolvedValue(makeBrand({ accountType: 'personal' }))
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([
      makePhoto({ id: 'p1', exifTakenAt: new Date('2026-07-12T15:00:00Z'), gpsLat: -23.5, gpsLng: -46.6 }),
      makePhoto({ id: 'p2', exifTakenAt: new Date('2026-07-12T16:00:00Z'), gpsLat: -23.5, gpsLng: -46.6 }),
    ])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(captionClient.suggestCaption).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'personal',
        photoTakenAt: '2026-07-12T15:00:00.000Z',
        photoHasLocation: true,
        photoCount: 2,
      }),
    )
  })

  it('collapses near-identical photos into a single carousel slot and marks the extras as duplicates', async () => {
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([
      makePhoto({ id: 'p1', perceptualHash: 'aaaaaaaaaaaaaaaa' }),
      makePhoto({ id: 'p2', perceptualHash: 'aaaaaaaaaaaaaaaa' }), // idêntica a p1 → extra
      makePhoto({ id: 'p3', perceptualHash: '5555555555555555' }), // bem diferente → mantida
    ])

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const scheduledPhotoIds = items.flatMap((i) => i.photoIds)
    expect(scheduledPhotoIds).toContain('p1')
    expect(scheduledPhotoIds).toContain('p3')
    expect(scheduledPhotoIds).not.toContain('p2')
    expect(photoRepo.saveAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p2', duplicateOfPhotoId: 'p1' })]),
    )
  })

  it('excludes a panoramic photo from any carousel and marks it as unsupported when the campaign targets Instagram', async () => {
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([
      makePhoto({ id: 'p1', aspectRatio: 1 }),
      makePhoto({ id: 'panorama', aspectRatio: 2.4 }),
    ])

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const scheduledPhotoIds = items.flatMap((i) => i.photoIds)
    expect(scheduledPhotoIds).toContain('p1')
    expect(scheduledPhotoIds).not.toContain('panorama')
    expect(photoRepo.saveAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'panorama', unsupportedAspectRatio: true })]),
    )
  })

  it('does not exclude a panoramic photo when the campaign does not target Instagram', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ platforms: [Platform.FACEBOOK] }))
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'panorama', aspectRatio: 2.4 })])

    const items = await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(items.flatMap((i) => i.photoIds)).toContain('panorama')
  })

  it('rejects when every photo has an aspect ratio unsupported by Instagram', async () => {
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'panorama', aspectRatio: 2.4 })])

    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('unsupported by Instagram')
  })

  it('defaults to a professional accountType when the brand has no record', async () => {
    vi.mocked(brandRepo.findById).mockResolvedValue(null)

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(captionClient.suggestCaption).toHaveBeenCalledWith(expect.objectContaining({ accountType: 'professional' }))
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
