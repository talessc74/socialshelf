import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CampaignPhoto, PhotoCampaign } from '@socialshelf/domain'
import { captionForGroup, defaultCaption } from './campaignCaption.js'
import type { CampaignCaptionClient } from '../../infrastructure/generator/CampaignCaptionClient.js'

function makeCampaign(overrides: Partial<PhotoCampaign> = {}): PhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem',
    keywords: ['viagem'],
    platforms: [],
    postsPerDay: 1,
    carouselSizeDefault: 5,
    status: 'reviewing',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function makePhoto(overrides: Partial<CampaignPhoto> = {}): CampaignPhoto {
  return {
    id: 'p1',
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    storagePath: 'p1.jpg',
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

describe('captionForGroup', () => {
  let captionClient: CampaignCaptionClient

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the AI caption when the call succeeds', async () => {
    captionClient = { suggestCaption: vi.fn().mockResolvedValue({ caption: 'Legenda real' }) }
    const photo = makePhoto()
    const result = await captionForGroup(captionClient, makeCampaign(), new Map([[photo.id, photo]]), [photo.id], 'professional')
    expect(result).toBe('Legenda real')
  })

  it('logs the real error to console.error instead of failing silently when the AI call throws', async () => {
    captionClient = { suggestCaption: vi.fn().mockRejectedValue(new Error('Failed to suggest campaign caption: 500 boom')) }
    const photo = makePhoto()
    await captionForGroup(captionClient, makeCampaign(), new Map([[photo.id, photo]]), [photo.id], 'professional')

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('boom'))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('campaign-1'))
  })

  it('falls back to the plain default caption (no leaked error text) when the AI call throws', async () => {
    captionClient = { suggestCaption: vi.fn().mockRejectedValue(new Error('boom detail here')) }
    const photo = makePhoto()
    const result = await captionForGroup(captionClient, makeCampaign(), new Map([[photo.id, photo]]), [photo.id], 'professional')

    expect(result).toBe(defaultCaption(makeCampaign()))
    expect(result).not.toContain('boom detail here')
  })

  it('falls back to the plain default caption when there is simply no cover photo to look up', async () => {
    captionClient = { suggestCaption: vi.fn() }
    const result = await captionForGroup(captionClient, makeCampaign(), new Map(), ['missing-photo'], 'professional')

    expect(result).toBe(defaultCaption(makeCampaign()))
    expect(captionClient.suggestCaption).not.toHaveBeenCalled()
  })
})
