import { describe, it, expect } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { CampaignPhoto } from '@socialshelf/domain'
import {
  isUnsupportedForInstagram,
  splitByAspectRatioSupport,
  INSTAGRAM_MIN_ASPECT_RATIO,
  INSTAGRAM_MAX_ASPECT_RATIO,
} from './unsupportedAspectRatio.js'

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

describe('isUnsupportedForInstagram', () => {
  it('treats null (sharp could not decode dimensions) as supported, never a false positive', () => {
    expect(isUnsupportedForInstagram(null)).toBe(false)
  })

  it('accepts a square photo (1:1)', () => {
    expect(isUnsupportedForInstagram(1)).toBe(false)
  })

  it('accepts the exact boundary values', () => {
    expect(isUnsupportedForInstagram(INSTAGRAM_MIN_ASPECT_RATIO)).toBe(false)
    expect(isUnsupportedForInstagram(INSTAGRAM_MAX_ASPECT_RATIO)).toBe(false)
  })

  it('rejects a panorama photo (very wide, ratio > 1.91)', () => {
    expect(isUnsupportedForInstagram(2.4)).toBe(true)
  })

  it('rejects an extremely tall photo (ratio < 0.8)', () => {
    expect(isUnsupportedForInstagram(0.5)).toBe(true)
  })
})

describe('splitByAspectRatioSupport', () => {
  it('excludes nothing when the campaign does not target Instagram', () => {
    const panorama = makePhoto({ id: 'panorama', aspectRatio: 2.4 })
    const result = splitByAspectRatioSupport([panorama], [Platform.FACEBOOK, Platform.LINKEDIN])
    expect(result.supported).toEqual([panorama])
    expect(result.unsupported).toEqual([])
  })

  it('excludes a panorama photo when Instagram is among the target platforms', () => {
    const ok = makePhoto({ id: 'ok', aspectRatio: 1 })
    const panorama = makePhoto({ id: 'panorama', aspectRatio: 2.4 })
    const result = splitByAspectRatioSupport([ok, panorama], [Platform.INSTAGRAM])
    expect(result.supported).toEqual([ok])
    expect(result.unsupported).toEqual([panorama])
  })

  it('never excludes a photo whose aspect ratio could not be determined', () => {
    const unknown = makePhoto({ id: 'unknown', aspectRatio: null })
    const result = splitByAspectRatioSupport([unknown], [Platform.INSTAGRAM])
    expect(result.supported).toEqual([unknown])
    expect(result.unsupported).toEqual([])
  })
})
