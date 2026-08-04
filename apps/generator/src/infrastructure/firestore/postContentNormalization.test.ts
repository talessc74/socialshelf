import { describe, it, expect } from 'vitest'
import { Platform } from '@socialshelf/domain'
import { normalizePostContent } from './postContentNormalization.js'

describe('normalizePostContent', () => {
  it('passes through a well-formed content array unchanged', () => {
    const content = [{ platform: Platform.LINKEDIN, text: 'Legenda pronta', charCount: 14 }]
    expect(normalizePostContent(content)).toEqual(content)
  })

  it('joins a platform text that was persisted as an array of paragraphs into a single string', () => {
    const raw = [
      { platform: Platform.LINKEDIN, text: ['Primeiro parágrafo.', 'Segundo parágrafo.'], charCount: 999 },
    ]

    const result = normalizePostContent(raw)

    expect(result[0]!.text).toBe('Primeiro parágrafo.\n\nSegundo parágrafo.')
    // charCount é sempre recalculado a partir do texto final, nunca herdado do valor gravado
    // (que veio errado do bug de origem, _local-edr-policy-074).
    expect(result[0]!.charCount).toBe(result[0]!.text.length)
  })

  it('falls back to an empty string when a platform text is neither a string nor an array of strings', () => {
    const raw = [{ platform: Platform.LINKEDIN, text: 42, charCount: 2 }]

    const result = normalizePostContent(raw)

    expect(result[0]!.text).toBe('')
    expect(result[0]!.charCount).toBe(0)
  })

  it('returns an empty array when content is missing or not an array', () => {
    expect(normalizePostContent(undefined)).toEqual([])
    expect(normalizePostContent(null)).toEqual([])
    expect(normalizePostContent('not an array')).toEqual([])
  })
})
