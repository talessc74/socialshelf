import { describe, it, expect } from 'vitest'
import { normalizeBrandProfileOperation } from './brandProfileNormalization.js'

describe('normalizeBrandProfileOperation', () => {
  it('passes through a fully-formed operation unchanged', () => {
    const operation = {
      autonomyLevel: 'automatic' as const,
      autoPublishTopics: ['lançamentos'],
      blockedTopics: ['política'],
      maxAutoPostsPerDay: 3,
      stylePreferences: ['bold-bottom', 'centered-overlay', 'top-strip', 'no-text'],
      dailyAiSpendingLimitBrl: 50,
    }
    expect(normalizeBrandProfileOperation(operation)).toEqual(operation)
  })

  it('defaults maxAutoPostsPerDay to 1 when the field predates the feature', () => {
    expect(normalizeBrandProfileOperation({ autonomyLevel: 'manual' }).maxAutoPostsPerDay).toBe(1)
  })

  it('defaults stylePreferences to the full permutation when the field predates the feature', () => {
    const result = normalizeBrandProfileOperation({})
    expect(result.stylePreferences).toEqual(['bold-bottom', 'centered-overlay', 'top-strip', 'no-text'])
  })

  it('defaults dailyAiSpendingLimitBrl to null when the field predates the feature', () => {
    expect(normalizeBrandProfileOperation({}).dailyAiSpendingLimitBrl).toBeNull()
  })
})
