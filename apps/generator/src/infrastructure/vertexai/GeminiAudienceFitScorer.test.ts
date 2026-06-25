import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContent = vi.fn()

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
  })),
}))

import { GeminiAudienceFitScorer } from './GeminiAudienceFitScorer.js'

function respondWith(text: string) {
  generateContent.mockResolvedValueOnce({
    response: { candidates: [{ content: { parts: [{ text }] } }] },
  })
}

const business = { name: 'Acme LegalTech', segment: 'legaltech', description: 'IA jurídica' }

describe('GeminiAudienceFitScorer', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('returns an empty array without calling the model when there are no items', async () => {
    const result = await new GeminiAudienceFitScorer('p', 'global', 'gemini-2.5-flash').score({
      business,
      recurringThemes: [],
      items: [],
    })

    expect(result).toEqual([])
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('parses relevanceStrength and matchedThemes from the model response, preserving order', async () => {
    respondWith(
      JSON.stringify({
        items: [
          { relevanceStrength: 0, matchedThemes: [] },
          { relevanceStrength: 3, matchedThemes: ['inteligência artificial'] },
        ],
      }),
    )

    const result = await new GeminiAudienceFitScorer('p', 'global', 'gemini-2.5-flash').score({
      business,
      recurringThemes: ['inteligência artificial'],
      items: [
        { headline: 'Notícia sem relação', summary: 'Assunto neutro' },
        { headline: 'IA vence causa no Reino Unido', summary: 'Tribunal usa IA em decisão histórica' },
      ],
    })

    expect(result).toEqual([
      { relevanceStrength: 0, matchedThemes: [] },
      { relevanceStrength: 3, matchedThemes: ['inteligência artificial'] },
    ])
  })

  it('clamps relevanceStrength to the 0-3 range and rounds non-integer values', async () => {
    respondWith(JSON.stringify({ items: [{ relevanceStrength: 7.6, matchedThemes: [] }] }))

    const result = await new GeminiAudienceFitScorer('p', 'global', 'gemini-2.5-flash').score({
      business,
      recurringThemes: [],
      items: [{ headline: 'h', summary: 's' }],
    })

    expect(result[0]?.relevanceStrength).toBe(3)
  })

  it('throws when the model returns a different number of items than requested', async () => {
    respondWith(JSON.stringify({ items: [{ relevanceStrength: 1, matchedThemes: [] }] }))

    await expect(
      new GeminiAudienceFitScorer('p', 'global', 'gemini-2.5-flash').score({
        business,
        recurringThemes: [],
        items: [
          { headline: 'a', summary: 'a' },
          { headline: 'b', summary: 'b' },
        ],
      }),
    ).rejects.toThrow('malformed audience fit scoring payload')
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiAudienceFitScorer('p', 'global', 'gemini-2.5-flash').score({
        business,
        recurringThemes: [],
        items: [{ headline: 'a', summary: 'a' }],
      }),
    ).rejects.toThrow('invalid JSON for audience fit scoring')
  })
})
