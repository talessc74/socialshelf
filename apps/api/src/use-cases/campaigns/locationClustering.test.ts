import { describe, it, expect } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { CampaignPhoto } from '@socialshelf/domain'
import {
  clusterByLocation,
  computeScheduledTimes,
  groupIntoCarousels,
  interleaveGroups,
  maxCarouselSizeForPlatforms,
  NO_LOCATION_CLUSTER_ID,
} from './locationClustering.js'

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
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides,
  }
}

describe('maxCarouselSizeForPlatforms', () => {
  it('returns the smallest cap among selected platforms', () => {
    expect(maxCarouselSizeForPlatforms([Platform.INSTAGRAM, Platform.LINKEDIN])).toBe(10)
  })

  it('returns LinkedIn cap when only LinkedIn is selected', () => {
    expect(maxCarouselSizeForPlatforms([Platform.LINKEDIN])).toBe(20)
  })

  it('falls back to 10 when no platform has a known cap', () => {
    expect(maxCarouselSizeForPlatforms([])).toBe(10)
  })
})

describe('clusterByLocation', () => {
  it('groups photos within ~150m into the same cluster', () => {
    const photos = [
      makePhoto({ id: 'a', gpsLat: 48.8584, gpsLng: 2.2945 }),
      makePhoto({ id: 'b', gpsLat: 48.8585, gpsLng: 2.2946 }),
    ]

    const clusters = clusterByLocation(photos)

    expect(clusters.size).toBe(1)
    expect([...clusters.values()][0]!.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('splits photos more than ~150m apart into different clusters', () => {
    const photos = [
      makePhoto({ id: 'eiffel', gpsLat: 48.8584, gpsLng: 2.2945 }),
      makePhoto({ id: 'louvre', gpsLat: 48.8606, gpsLng: 2.3376 }),
    ]

    const clusters = clusterByLocation(photos)

    expect(clusters.size).toBe(2)
  })

  it('puts photos without GPS into the NO_LOCATION_CLUSTER_ID bucket', () => {
    const photos = [makePhoto({ id: 'no-gps', gpsLat: null, gpsLng: null })]

    const clusters = clusterByLocation(photos)

    expect(clusters.has(NO_LOCATION_CLUSTER_ID)).toBe(true)
    expect(clusters.get(NO_LOCATION_CLUSTER_ID)!.map((p) => p.id)).toEqual(['no-gps'])
  })

  it('orders photos within a cluster by EXIF captured time', () => {
    const photos = [
      makePhoto({ id: 'later', gpsLat: 1, gpsLng: 1, exifTakenAt: new Date('2026-07-01T12:00:00.000Z') }),
      makePhoto({ id: 'earlier', gpsLat: 1, gpsLng: 1, exifTakenAt: new Date('2026-07-01T09:00:00.000Z') }),
    ]

    const clusters = clusterByLocation(photos)

    expect([...clusters.values()][0]!.map((p) => p.id)).toEqual(['earlier', 'later'])
  })
})

describe('groupIntoCarousels', () => {
  it('splits photos into groups of the given size', () => {
    const photos = ['a', 'b', 'c', 'd', 'e'].map((id) => makePhoto({ id }))
    expect(groupIntoCarousels(photos, 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  it('treats size 1 as one photo per post', () => {
    const photos = ['a', 'b'].map((id) => makePhoto({ id }))
    expect(groupIntoCarousels(photos, 1)).toEqual([['a'], ['b']])
  })
})

describe('interleaveGroups', () => {
  it('round-robins groups across clusters so the same cluster never repeats back-to-back when alternatives exist', () => {
    const result = interleaveGroups([
      [['a1'], ['a2'], ['a3']],
      [['b1'], ['b2']],
    ])

    expect(result).toEqual([['a1'], ['b1'], ['a2'], ['b2'], ['a3']])
  })
})

describe('computeScheduledTimes', () => {
  it('schedules a single post per day at 9am', () => {
    const times = computeScheduledTimes(2, 1, new Date('2026-07-10T00:00:00.000Z'))
    expect(times[0]!.getHours()).toBe(9)
    expect(times[1]!.getDate()).toBe(times[0]!.getDate() + 1)
  })

  it('spreads postsPerDay evenly between 9h and 21h', () => {
    const times = computeScheduledTimes(3, 3, new Date('2026-07-10T00:00:00.000Z'))
    expect(times.map((t) => t.getHours())).toEqual([9, 15, 21])
    expect(new Set(times.map((t) => t.getDate())).size).toBe(1)
  })

  it('rolls over to the next day once postsPerDay is reached', () => {
    const times = computeScheduledTimes(4, 2, new Date('2026-07-10T00:00:00.000Z'))
    expect(times[0]!.getDate()).toBe(times[1]!.getDate())
    expect(times[2]!.getDate()).toBe(times[0]!.getDate() + 1)
  })
})
