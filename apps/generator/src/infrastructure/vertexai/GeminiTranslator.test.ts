import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiUsageRecorderPort } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiTranslator } from './GeminiTranslator.js'

function respondWith(text: string, usageMetadata?: unknown) {
  generateContent.mockResolvedValueOnce({ text, usageMetadata })
}

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn().mockResolvedValue(undefined) }
}

describe('GeminiTranslator', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('returns an empty array without calling the model when there is nothing to translate', async () => {
    const result = await new GeminiTranslator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).translate({
      texts: [],
      targetLanguage: 'português do Brasil',
      userId: 'user-1',
      brandId: 'brand-1',
    })

    expect(result).toEqual([])
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('parses the translations array from the model response, preserving order', async () => {
    respondWith(JSON.stringify({ translations: ['Olá mundo', 'Resumo traduzido'] }))

    const result = await new GeminiTranslator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).translate({
      texts: ['Hello world', 'Translated summary'],
      targetLanguage: 'português do Brasil',
      userId: 'user-1',
      brandId: 'brand-1',
    })

    expect(result).toEqual(['Olá mundo', 'Resumo traduzido'])
  })

  it('records AI usage with the translation operation and the caller userId/brandId', async () => {
    respondWith(JSON.stringify({ translations: ['Olá mundo'] }), { promptTokenCount: 10, candidatesTokenCount: 5 })
    const usageRecorder = makeUsageRecorder()

    await new GeminiTranslator('p', 'global', 'gemini-2.5-flash', usageRecorder).translate({
      texts: ['Hello world'],
      targetLanguage: 'português do Brasil',
      userId: 'user-1',
      brandId: 'brand-1',
    })

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'text-generation',
        operation: 'translation',
        model: 'gemini-2.5-flash',
      }),
    )
  })

  it('throws when the model returns a different number of items than requested', async () => {
    respondWith(JSON.stringify({ translations: ['só um'] }))

    await expect(
      new GeminiTranslator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).translate({
        texts: ['a', 'b'],
        targetLanguage: 'português do Brasil',
        userId: 'user-1',
        brandId: 'brand-1',
      }),
    ).rejects.toThrow('malformed translation payload')
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiTranslator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).translate({
        texts: ['a'],
        targetLanguage: 'português do Brasil',
        userId: 'user-1',
        brandId: 'brand-1',
      }),
    ).rejects.toThrow('invalid JSON for translation')
  })
})
