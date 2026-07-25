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
import { DiscardCampaignUseCase } from './DiscardCampaignUseCase.js'

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

describe('DiscardCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let itemRepo: CampaignItemRepository
  let photoRepo: CampaignPhotoRepository
  let useCase: DiscardCampaignUseCase

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
      findCancelledForPhotoCleanup: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    }
    itemRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([]),
      deleteByCampaign: vi.fn().mockResolvedValue(undefined),
    }
    photoRepo = {
      save: vi.fn(),
      saveAll: vi.fn(),
      findByCampaign: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
      deleteByCampaign: vi.fn().mockResolvedValue(undefined),
    }
    useCase = new DiscardCampaignUseCase(campaignRepo, itemRepo, photoRepo, 'http://localhost:3003', 'internal-secret')
  })

  it('throws when the campaign does not exist', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(null)

    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('Campaign not found')
  })

  it.each(['draft', 'reviewing', 'active', 'paused', 'completed'] as const)(
    'rejects discarding a campaign that is %s, not cancelled',
    async (status) => {
      vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))

      await expect(
        useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
      ).rejects.toThrow('Only cancelled campaigns can be discarded')
      expect(campaignRepo.delete).not.toHaveBeenCalled()
    },
  )

  it('deletes the campaign, its items and its photos', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ status: 'planned', photoIds: ['photo-1'] })])
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'photo-1' })])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(itemRepo.deleteByCampaign).toHaveBeenCalledWith('campaign-1')
    expect(photoRepo.deleteByCampaign).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
    expect(campaignRepo.delete).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('deletes the blob of a photo never used by a real post', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ status: 'planned', photoIds: ['photo-1'] })])
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'photo-1' })])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3003/images/delete')
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).get('X-Internal-Secret')).toBe('internal-secret')
    expect(init.body).toBe(JSON.stringify({ path: 'user-1/brand-1/photo-1.jpg' }))
  })

  it('never deletes the blob of a photo whose item is materialized into a real post', async () => {
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([
      makeItem({ id: 'item-1', status: 'materialized', postId: 'post-1', photoIds: ['photo-1'] }),
      makeItem({ id: 'item-2', status: 'planned', photoIds: ['photo-2'] }),
    ])
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([
      makePhoto({ id: 'photo-1', storagePath: 'user-1/brand-1/photo-1.jpg' }),
      makePhoto({ id: 'photo-2', storagePath: 'user-1/brand-1/photo-2.jpg' }),
    ])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3003/images/delete',
      expect.objectContaining({ body: JSON.stringify({ path: 'user-1/brand-1/photo-2.jpg' }) }),
    )
    // Mesmo protegendo o blob, o registro de bookkeeping da campanha some por completo —
    // deleteByCampaign apaga todos os CampaignPhoto, protegidos ou não.
    expect(photoRepo.deleteByCampaign).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('still deletes the campaign and its records even when a blob delete fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'))
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem({ status: 'planned', photoIds: ['photo-1'] })])
    vi.mocked(photoRepo.findByCampaign).mockResolvedValue([makePhoto({ id: 'photo-1' })])

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(campaignRepo.delete).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })
})
