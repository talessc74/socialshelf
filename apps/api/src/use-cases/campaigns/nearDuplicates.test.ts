import { describe, it, expect } from 'vitest'
import type { CampaignPhoto } from '@socialshelf/domain'
import { collapseNearDuplicates, hammingDistanceHex, NEAR_DUPLICATE_THRESHOLD } from './nearDuplicates.js'

function makePhoto(id: string, perceptualHash: string | null): CampaignPhoto {
  return {
    id,
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    storagePath: `${id}.jpg`,
    exifTakenAt: null,
    gpsLat: null,
    gpsLng: null,
    locationClusterId: null,
    createdAt: new Date(),
    order: null,
    perceptualHash,
    duplicateOfPhotoId: null,
  }
}

describe('hammingDistanceHex', () => {
  it('is zero for identical hashes', () => {
    expect(hammingDistanceHex('ffff0000ffff0000', 'ffff0000ffff0000')).toBe(0)
  })

  it('counts the differing bits', () => {
    // 0x0 vs 0xf → 4 bits; resto igual.
    expect(hammingDistanceHex('0000000000000000', '000000000000000f')).toBe(4)
    expect(hammingDistanceHex('0000000000000000', 'f000000000000000')).toBe(4)
  })

  it('returns Infinity for hashes of different lengths', () => {
    expect(hammingDistanceHex('ffff', 'ffffffff')).toBe(Infinity)
  })
})

describe('collapseNearDuplicates', () => {
  it('keeps a single representative and moves near-identical photos to extras', () => {
    const a = makePhoto('a', '0000000000000000')
    const b = makePhoto('b', '0000000000000001') // 1 bit de diferença → quase-igual
    const c = makePhoto('c', 'ffffffffffffffff') // muito diferente

    const { kept, extras } = collapseNearDuplicates([a, b, c])

    expect(kept.map((p) => p.id)).toEqual(['a', 'c'])
    expect(extras).toEqual([{ photo: b, representativeId: 'a' }])
  })

  it('never treats photos without a perceptual hash as duplicates', () => {
    const a = makePhoto('a', null)
    const b = makePhoto('b', null)

    const { kept, extras } = collapseNearDuplicates([a, b])

    expect(kept.map((p) => p.id)).toEqual(['a', 'b'])
    expect(extras).toHaveLength(0)
  })

  it('preserves the original order of the representatives', () => {
    const photos = [makePhoto('a', '0000000000000000'), makePhoto('b', 'ffffffffffffffff'), makePhoto('c', '0f0f0f0f0f0f0f0f')]
    const { kept } = collapseNearDuplicates(photos)
    expect(kept.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('does not collapse photos just beyond the threshold', () => {
    const a = makePhoto('a', '0000000000000000')
    // 9 bits de diferença (> threshold 8): 0xf=4, 0xf=4, 0x1=1 → 9.
    const b = makePhoto('b', 'ff10000000000000')
    expect(hammingDistanceHex(a.perceptualHash!, b.perceptualHash!)).toBe(9)

    const { kept, extras } = collapseNearDuplicates([a, b])
    expect(kept.map((p) => p.id)).toEqual(['a', 'b'])
    expect(extras).toHaveLength(0)
  })

  it('uses the configured default threshold', () => {
    expect(NEAR_DUPLICATE_THRESHOLD).toBe(8)
  })
})
