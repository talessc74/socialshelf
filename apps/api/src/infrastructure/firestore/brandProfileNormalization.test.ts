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
    }
    expect(normalizeBrandProfileOperation(operation)).toEqual(operation)
  })

  it('defaults maxAutoPostsPerDay to 1 when the field predates the feature (undefined in Firestore)', () => {
    const operation = {
      autonomyLevel: 'semi-automatic' as const,
      autoPublishTopics: [],
      blockedTopics: [],
      stylePreferences: ['bold-bottom', 'centered-overlay', 'top-strip', 'no-text'],
    }
    expect(normalizeBrandProfileOperation(operation).maxAutoPostsPerDay).toBe(1)
  })

  it('clamps an out-of-range maxAutoPostsPerDay into 1..10', () => {
    expect(normalizeBrandProfileOperation({ maxAutoPostsPerDay: 0 }).maxAutoPostsPerDay).toBe(1)
    expect(normalizeBrandProfileOperation({ maxAutoPostsPerDay: 99 }).maxAutoPostsPerDay).toBe(10)
    expect(normalizeBrandProfileOperation({ maxAutoPostsPerDay: 2.7 }).maxAutoPostsPerDay).toBe(3)
  })

  it('defaults stylePreferences to the full permutation when the field predates the feature', () => {
    const result = normalizeBrandProfileOperation({ autonomyLevel: 'manual' })
    expect(result.stylePreferences).toEqual(['bold-bottom', 'centered-overlay', 'top-strip', 'no-text'])
  })

  it('discards a stylePreferences that is not a full 4-item permutation instead of failing later validation', () => {
    const result = normalizeBrandProfileOperation({ stylePreferences: ['bold-bottom'] })
    expect(result.stylePreferences).toHaveLength(4)
  })

  it('defaults autonomyLevel and topic lists when the whole operation object is missing', () => {
    const result = normalizeBrandProfileOperation(undefined)
    expect(result).toEqual({
      autonomyLevel: 'manual',
      autoPublishTopics: [],
      blockedTopics: [],
      maxAutoPostsPerDay: 1,
      stylePreferences: ['bold-bottom', 'centered-overlay', 'top-strip', 'no-text'],
    })
  })
})
