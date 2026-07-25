import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  CampaignItem,
  CampaignItemRepository,
  CampaignPhoto,
  CampaignPhotoRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
} from '@socialshelf/domain'
import { CleanupCancelledCampaignPhotosUseCase } from './CleanupCancelledCampaignPhotosUseCase.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

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
    carouselSizeDefault: 2,
    status: 'cancelled',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    startedAt: new Date('2026-06-05T00:00:00.000Z'),
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
    caption: '',
    scheduledAt: new Date('2026-06-10T09:00:00.000Z'),
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
    storagePath: 'user-1/brand-1/photo-1.jpg',
    exifTakenAt: null,
    gpsLat: null,
    gpsLng: null,
    locationClusterId: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    order: null,
    perceptualHash: null,
    duplicateOfPhotoId: null,
    aspectRatio: null,
    unsupportedAspectRatio: false,
    ...overrides,
  }
}

describe('CleanupCancelledCampaignPhotosUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let itemRepo: CampaignItemRepository
  let photoRepo: CampaignPhotoRepository
  let useCase: CleanupCancelledCampaignPhotosUseCase

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findCancelledForPhotoCleanup: vi.fn().mockResolvedValue([]),
    }
    itemRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([]),
      deleteByCampaign: vi.fn(),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    useCase = new CleanupCancelledCampaignPhotosUseCase(campaignRepo, itemRepo, photoRepo, 'http://localhost:3003', 'internal-secret', 7)
  })

  it('deletes photos never used by a real post and marks photosDeletedAt', async () => {
    const campaign = makeCampaign()
    vi.mocked(campaignRepo.findCancelledForPhotoCleanup).mockResolvedValue([campaign])
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ status: 'planned', photoIds: ['photo-1'] })])
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'photo-1' })])

    const result = await useCase.execute()

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3003/images/delete')
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).get('X-Internal-Secret')).toBe('internal-secret')
    expect(init.body).toBe(JSON.stringify({ path: 'user-1/brand-1/photo-1.jpg' }))
    expect(campaignRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'campaign-1', photosDeletedAt: expect.any(Date) }))
    expect(result).toEqual({ campaignsCleaned: 1, blobsDeleted: 1, blobsFailed: 0 })
  })

  it('never deletes a photo whose item is materialized into a real post', async () => {
    const campaign = makeCampaign()
    vi.mocked(campaignRepo.findCancelledForPhotoCleanup).mockResolvedValue([campaign])
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([
      makeItem({ id: 'item-1', status: 'materialized', postId: 'post-1', photoIds: ['photo-1'] }),
      makeItem({ id: 'item-2', status: 'planned', photoIds: ['photo-2'] }),
    ])
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([
      makePhoto({ id: 'photo-1', storagePath: 'user-1/brand-1/photo-1.jpg' }),
      makePhoto({ id: 'photo-2', storagePath: 'user-1/brand-1/photo-2.jpg' }),
    ])

    const result = await useCase.execute()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3003/images/delete',
      expect.objectContaining({ body: JSON.stringify({ path: 'user-1/brand-1/photo-2.jpg' }) }),
    )
    expect(result).toEqual({ campaignsCleaned: 1, blobsDeleted: 1, blobsFailed: 0 })
  })

  it('does nothing when there are no cancelled campaigns due for cleanup', async () => {
    vi.mocked(campaignRepo.findCancelledForPhotoCleanup).mockResolvedValue([])

    const result = await useCase.execute()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(campaignRepo.save).not.toHaveBeenCalled()
    expect(result).toEqual({ campaignsCleaned: 0, blobsDeleted: 0, blobsFailed: 0 })
  })
})
