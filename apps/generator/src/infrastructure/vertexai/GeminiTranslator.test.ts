import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContent = vi.fn()

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
  })),
}))

import { GeminiTranslator } from './GeminiTranslator.js'

function respondWith(text: string) {
  generateContent.mockResolvedValueOnce({
    response: { candidates: [{ content: { parts: [{ text }] } }] },
  })
}

describe('GeminiTranslator', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('returns an empty array without calling the model when there is nothing to translate', async () => {
    const result = await new GeminiTranslator('p', 'global', 'gemini-2.5-flash').translate({
      texts: [],
      targetLanguage: 'português do Brasil',
    })

    expect(result).toEqual([])
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('parses the translations array from the model response, preserving order', async () => {
    respondWith(JSON.stringify({ translations: ['Olá mundo', 'Resumo traduzido'] }))

    const result = await new GeminiTranslator('p', 'global', 'gemini-2.5-flash').translate({
      texts: ['Hello world', 'Translated summary'],
      targetLanguage: 'português do Brasil',
    })

    expect(result).toEqual(['Olá mundo', 'Resumo traduzido'])
  })

  it('throws when the model returns a different number of items than requested', async () => {
    respondWith(JSON.stringify({ translations: ['só um'] }))

    await expect(
      new GeminiTranslator('p', 'global', 'gemini-2.5-flash').translate({
        texts: ['a', 'b'],
        targetLanguage: 'português do Brasil',
      }),
    ).rejects.toThrow('malformed translation payload')
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiTranslator('p', 'global', 'gemini-2.5-flash').translate({
        texts: ['a'],
        targetLanguage: 'português do Brasil',
      }),
    ).rejects.toThrow('invalid JSON for translation')
  })
})
