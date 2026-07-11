import { randomUUID } from 'crypto'
import { Platform, computeDailySlotHours } from '@socialshelf/domain'
import type { CampaignPhoto } from '@socialshelf/domain'

// Teto real de carrossel por rede — Instagram e Facebook aceitam até 10 itens (MetaPublisher),
// LinkedIn até 20 (LinkedInPublisher.multiImage). X fica fora do seletor de campanha
// (_local-adr-policy-041) e por isso nunca aparece aqui.
const PLATFORM_CAROUSEL_CAPS: Partial<Record<Platform, number>> = {
  [Platform.INSTAGRAM]: 10,
  [Platform.FACEBOOK]: 10,
  [Platform.LINKEDIN]: 20,
}

export function maxCarouselSizeForPlatforms(platforms: Platform[]): number {
  const caps = platforms.map((p) => PLATFORM_CAROUSEL_CAPS[p]).filter((c): c is number => c !== undefined)
  return caps.length > 0 ? Math.min(...caps) : 10
}

const EARTH_RADIUS_METERS = 6371000
const CLUSTER_RADIUS_METERS = 150
export const NO_LOCATION_CLUSTER_ID = 'no-location'

function haversineDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

// Prioriza a posição manual (CampaignPhoto.order) quando ambas as fotos comparadas já têm
// uma — é o único jeito de o usuário controlar a sequência de fotos sem GPS/EXIF (ex: prints
// de tela), já que aí não existe nenhum outro dado real pra ordenar por localidade/data.
function sortWithinCluster(photos: CampaignPhoto[]): CampaignPhoto[] {
  return [...photos].sort((a, b) => {
    if (a.order !== null && b.order !== null) return a.order - b.order
    return (a.exifTakenAt ?? a.createdAt).getTime() - (b.exifTakenAt ?? b.createdAt).getTime()
  })
}

/**
 * Clusteriza fotos por proximidade GPS (single-linkage guloso, raio de 150m) e ordena cada
 * cluster por data de captura (EXIF). Fotos sem GPS caem no cluster NO_LOCATION_CLUSTER_ID,
 * ordenadas do mesmo jeito. Retorna um Map preservando a ordem de descoberta dos clusters.
 */
export function clusterByLocation(photos: CampaignPhoto[]): Map<string, CampaignPhoto[]> {
  const withGps = photos.filter((p) => p.gpsLat !== null && p.gpsLng !== null)
  const withoutGps = photos.filter((p) => p.gpsLat === null || p.gpsLng === null)

  const clusters: Array<{ id: string; centroid: { lat: number; lng: number }; photos: CampaignPhoto[] }> = []
  for (const photo of withGps) {
    const point = { lat: photo.gpsLat!, lng: photo.gpsLng! }
    const existing = clusters.find((c) => haversineDistanceMeters(c.centroid, point) <= CLUSTER_RADIUS_METERS)
    if (existing) {
      const n = existing.photos.length + 1
      existing.centroid = {
        lat: existing.centroid.lat + (point.lat - existing.centroid.lat) / n,
        lng: existing.centroid.lng + (point.lng - existing.centroid.lng) / n,
      }
      existing.photos.push(photo)
    } else {
      clusters.push({ id: randomUUID(), centroid: point, photos: [photo] })
    }
  }

  const result = new Map<string, CampaignPhoto[]>()
  for (const cluster of clusters) {
    result.set(cluster.id, sortWithinCluster(cluster.photos))
  }
  if (withoutGps.length > 0) {
    result.set(NO_LOCATION_CLUSTER_ID, sortWithinCluster(withoutGps))
  }
  return result
}

/** Divide uma lista ordenada de fotos em grupos de até `carouselSize` (o último grupo pode sobrar menor). */
export function groupIntoCarousels(photos: CampaignPhoto[], carouselSize: number): string[][] {
  const size = Math.max(1, carouselSize)
  const groups: string[][] = []
  for (let i = 0; i < photos.length; i += size) {
    groups.push(photos.slice(i, i + size).map((p) => p.id))
  }
  return groups
}

/**
 * Intercala grupos de clusters diferentes (round-robin) pra não empilhar a mesma localidade
 * em posts consecutivos, mesmo que a ordem cronológica das fotos sugerisse isso.
 */
export function interleaveGroups(groupsByCluster: string[][][]): string[][] {
  const queues = groupsByCluster.filter((g) => g.length > 0).map((g) => [...g])
  const result: string[][] = []
  let remaining = queues.some((q) => q.length > 0)
  while (remaining) {
    remaining = false
    for (const q of queues) {
      const next = q.shift()
      if (next) {
        result.push(next)
        if (q.length > 0) remaining = true
      }
    }
  }
  return result
}

/**
 * Distribui `itemCount` horários ao longo dos dias a partir de `startDate`, `postsPerDay`
 * por dia, espaçados uniformemente entre 9h e 21h (1x/dia cai às 9h) — mesma janela de
 * computeDailySlotHours, também usada pelo gate de horário do tick de autonomia
 * (_local-edr-policy-038, adendo 2026-07-11).
 */
export function computeScheduledTimes(itemCount: number, postsPerDay: number, startDate: Date): Date[] {
  const slots = computeDailySlotHours(postsPerDay)

  const times: Date[] = []
  for (let i = 0; i < itemCount; i++) {
    const dayOffset = Math.floor(i / postsPerDay)
    const hour = slots[i % postsPerDay]!
    const date = new Date(startDate)
    date.setDate(date.getDate() + dayOffset)
    date.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0)
    times.push(date)
  }
  return times
}
