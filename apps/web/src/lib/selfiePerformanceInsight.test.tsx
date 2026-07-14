import { describe, it, expect } from 'vitest'
import { findBestPost, weekOverWeekDelta, buildPerformanceMessage } from './selfiePerformanceInsight'
import { Platform } from '@socialshelf/domain'
import type { ApiPostPerformanceEntry } from './api'

function makeEntry(overrides: Partial<ApiPostPerformanceEntry> = {}): ApiPostPerformanceEntry {
  return {
    postId: 'p1',
    platform: Platform.INSTAGRAM,
    text: 'texto',
    metrics: { impressions: 100, likes: 10, comments: 2, shares: 1 },
    score: 1,
    publishedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('findBestPost', () => {
  it('retorna null para lista vazia', () => {
    expect(findBestPost([])).toBeNull()
  })

  it('retorna o post de maior score', () => {
    const low = makeEntry({ postId: 'low', score: 1 })
    const high = makeEntry({ postId: 'high', score: 9 })
    expect(findBestPost([low, high])?.postId).toBe('high')
  })
})

describe('weekOverWeekDelta', () => {
  it('retorna null com dado de uma única semana', () => {
    const entries = [
      makeEntry({ publishedAt: '2026-07-06T10:00:00.000Z' }),
      makeEntry({ publishedAt: '2026-07-07T10:00:00.000Z' }),
    ]
    expect(weekOverWeekDelta(entries)).toBeNull()
  })

  it('calcula variação positiva entre duas semanas distintas', () => {
    const prevWeek = makeEntry({
      publishedAt: '2026-06-29T10:00:00.000Z', // semana anterior
      metrics: { impressions: 100, likes: 5, comments: 0, shares: 0 }, // 5% engajamento
    })
    const lastWeek = makeEntry({
      publishedAt: '2026-07-06T10:00:00.000Z', // semana seguinte
      metrics: { impressions: 100, likes: 10, comments: 0, shares: 0 }, // 10% engajamento
    })
    const delta = weekOverWeekDelta([prevWeek, lastWeek])
    expect(delta).not.toBeNull()
    expect(delta!).toBeCloseTo(100, 0) // dobrou = +100%
  })
})

describe('buildPerformanceMessage', () => {
  it('retorna null sem entradas', () => {
    expect(buildPerformanceMessage([])).toBeNull()
  })

  it('menciona a plataforma e o percentual de engajamento do melhor post', () => {
    const entry = makeEntry({ platform: Platform.LINKEDIN, score: 5 })
    const message = buildPerformanceMessage([entry])
    expect(message).toContain('LinkedIn')
    expect(message).toMatch(/\d+%/)
  })
})
