import { describe, it, expect, vi } from 'vitest'
import type { CampaignPhoto, CampaignPhotoRepository } from '@socialshelf/domain'
import { applyAspectRatioMarks } from './aspectRatioMarks.js'

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

describe('applyAspectRatioMarks', () => {
  it('marks a newly-unsupported photo and saves only it', async () => {
    const photoRepo: CampaignPhotoRepository = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn(),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    const supported = makePhoto({ id: 'ok', unsupportedAspectRatio: false })
    const panorama = makePhoto({ id: 'panorama', unsupportedAspectRatio: false })

    await applyAspectRatioMarks(photoRepo, [supported, panorama], [panorama])

    expect(photoRepo.saveAll).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(photoRepo.saveAll).mock.calls[0]![0]
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ id: 'panorama', unsupportedAspectRatio: true })
  })

  it('clears the mark on a photo that is no longer unsupported', async () => {
    const photoRepo: CampaignPhotoRepository = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn(),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    const previouslyUnsupported = makePhoto({ id: 'photo-1', unsupportedAspectRatio: true })

    await applyAspectRatioMarks(photoRepo, [previouslyUnsupported], [])

    expect(photoRepo.saveAll).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(photoRepo.saveAll).mock.calls[0]![0]
    expect(saved[0]).toMatchObject({ id: 'photo-1', unsupportedAspectRatio: false })
  })

  it('does not write anything when nothing changed', async () => {
    const photoRepo: CampaignPhotoRepository = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn(),
      delete: vi.fn(),
      countByCampaign: vi.fn(),
      reorder: vi.fn(),
    }
    const stable = makePhoto({ id: 'photo-1', unsupportedAspectRatio: false })

    await applyAspectRatioMarks(photoRepo, [stable], [])

    expect(photoRepo.saveAll).not.toHaveBeenCalled()
  })
})
