import { describe, it, expect } from 'vitest'
import { pickTopNewsInsight } from './selfieNewsInsight'
import { Platform } from '@socialshelf/domain'
import type { ApiTopicSuggestion } from './api'

function makeSuggestion(overrides: Partial<ApiTopicSuggestion> = {}): ApiTopicSuggestion {
  return {
    id: 's1',
    brandId: 'brand-1',
    headline: 'Manchete padrão',
    summary: 'Resumo',
    sourceUrl: 'https://example.com/a',
    sourceDomain: 'example.com',
    articleUrl: 'https://example.com/a',
    rationale: 'Conecta com o tema X da marca',
    audienceFitScore: 1,
    thumbnailUrl: null,
    publishedPlatforms: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  } as ApiTopicSuggestion
}

describe('pickTopNewsInsight', () => {
  it('retorna null para lista vazia', () => {
    expect(pickTopNewsInsight([])).toBeNull()
  })

  it('escolhe a sugestão de maior audienceFitScore', () => {
    const low = makeSuggestion({ id: 'low', audienceFitScore: 1, headline: 'Baixa aderência', rationale: 'r1' })
    const high = makeSuggestion({ id: 'high', audienceFitScore: 9, headline: 'Alta aderência', rationale: 'r2' })
    const result = pickTopNewsInsight([low, high])
    expect(result).toContain('Alta aderência')
    expect(result).toContain('r2')
  })

  it('retorna null se a melhor sugestão não tiver rationale', () => {
    const empty = makeSuggestion({ rationale: '' })
    expect(pickTopNewsInsight([empty])).toBeNull()
  })

  it('inclui headline e platform Instagram sem quebrar (smoke)', () => {
    const s = makeSuggestion({ publishedPlatforms: [Platform.INSTAGRAM] })
    expect(pickTopNewsInsight([s])).toContain('Manchete padrão')
  })
})
