import { describe, it, expect } from 'vitest'
import { pickTopSuggestion } from './selfieInsightsHighlight'
import type { ApiPerformanceSuggestion } from './api'

function makeSuggestion(overrides: Partial<ApiPerformanceSuggestion> = {}): ApiPerformanceSuggestion {
  return {
    id: 's1',
    brandId: 'brand-1',
    headline: 'Ideia padrão',
    rationale: 'rationale',
    viralScore: 5,
    basedOnThemes: [],
    feedback: null,
    bestTimeToPost: '',
    bestTimeWeekdays: [],
    bestTimeHourStart: 0,
    bestTimeHourEnd: 23,
    shelved: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('pickTopSuggestion', () => {
  it('retorna null sem sugestões em nenhuma das duas listas', () => {
    expect(pickTopSuggestion([], [])).toBeNull()
  })

  it('escolhe a de maior viralScore entre frescas e guardadas combinadas', () => {
    const fresh = [makeSuggestion({ id: 'f1', headline: 'Fresca fraca', viralScore: 3 })]
    const shelved = [makeSuggestion({ id: 'g1', headline: 'Guardada forte', viralScore: 9 })]
    const message = pickTopSuggestion(fresh, shelved)
    expect(message).toContain('Guardada forte')
    expect(message).toContain('9')
  })
})
