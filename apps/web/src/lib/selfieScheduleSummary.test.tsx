import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildScheduleSummary } from './selfieScheduleSummary'
import type { ApiPost } from './api'

function makePost(overrides: Partial<ApiPost> = {}): ApiPost {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: 1,
    content: [],
    imageStoragePaths: [],
    videoStoragePath: null,
    status: 'scheduled',
    origin: 'manual',
    externalIds: {},
    scheduledAt: null,
    publishedAt: null,
    imagesDeletedAt: null,
    savedForLater: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildScheduleSummary', () => {
  it('retorna null sem posts', () => {
    expect(buildScheduleSummary([], [])).toBeNull()
  })

  it('conta posts publicados hoje', () => {
    const publishedToday = makePost({ publishedAt: '2026-07-14T09:00:00.000Z' })
    const publishedOntem = makePost({ id: 'post-2', publishedAt: '2026-07-13T09:00:00.000Z' })
    const message = buildScheduleSummary([], [publishedToday, publishedOntem])
    expect(message).toContain('publicou 1 post')
  })

  it('conta posts agendados para o futuro', () => {
    const future = makePost({ scheduledAt: '2026-07-20T09:00:00.000Z' })
    const message = buildScheduleSummary([future], [])
    expect(message).toContain('1 agendado')
  })

  it('combina publicados hoje e agendados futuros na mesma mensagem', () => {
    const publishedToday = makePost({ publishedAt: '2026-07-14T09:00:00.000Z' })
    const future = makePost({ id: 'post-2', scheduledAt: '2026-07-20T09:00:00.000Z' })
    const message = buildScheduleSummary([future], [publishedToday])
    expect(message).toContain('publicou 1 post')
    expect(message).toContain('agendado')
  })

  it('retorna null se houver posts mas nenhum de hoje nem futuro', () => {
    const oldPost = makePost({ publishedAt: '2026-01-01T09:00:00.000Z' })
    expect(buildScheduleSummary([], [oldPost])).toBeNull()
  })
})
