import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiUsageRecorderPort } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiBrandDocumentExtractor } from './GeminiBrandDocumentExtractor.js'

function respondWith(text: string, usageMetadata?: unknown) {
  generateContent.mockResolvedValueOnce({ text, usageMetadata })
}

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn().mockResolvedValue(undefined) }
}

describe('GeminiBrandDocumentExtractor', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('parses a well-formed extraction from the model response', async () => {
    respondWith(JSON.stringify({ business: { name: 'Acme', segment: 'tech', description: 'desc' } }))

    const result = await new GeminiBrandDocumentExtractor(
      'p',
      'global',
      'gemini-2.5-flash',
      makeUsageRecorder(),
    ).extractFromDocument('ZmFrZQ==', 'application/pdf', 'user-1', 'brand-1')

    expect(result).toEqual({ business: { name: 'Acme', segment: 'tech', description: 'desc' } })
  })

  it('strips markdown code fences before parsing', async () => {
    respondWith('```json\n{"business": {"name": "Acme"}}\n```')

    const result = await new GeminiBrandDocumentExtractor(
      'p',
      'global',
      'gemini-2.5-flash',
      makeUsageRecorder(),
    ).extractFromDocument('ZmFrZQ==', 'application/pdf', 'user-1', 'brand-1')

    expect(result).toEqual({ business: { name: 'Acme' } })
  })

  it('records AI usage with the brand-document-extraction operation and the caller userId/brandId', async () => {
    respondWith(JSON.stringify({}))
    const usageRecorder = makeUsageRecorder()

    await new GeminiBrandDocumentExtractor('p', 'global', 'gemini-2.5-flash', usageRecorder).extractFromDocument(
      'ZmFrZQ==',
      'application/pdf',
      'user-1',
      'brand-1',
    )

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'text-generation',
        operation: 'brand-document-extraction',
        model: 'gemini-2.5-flash',
      }),
    )
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiBrandDocumentExtractor('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).extractFromDocument(
        'ZmFrZQ==',
        'application/pdf',
        'user-1',
        'brand-1',
      ),
    ).rejects.toThrow('invalid JSON for brand document extraction')
  })
})
