import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiUsageRecorderPort } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiTopicQueryPlanner } from './GeminiTopicQueryPlanner.js'

function respondWith(text: string, usageMetadata?: unknown) {
  generateContent.mockResolvedValueOnce({ text, usageMetadata })
}

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn().mockResolvedValue(undefined) }
}

const business = { name: 'Acme LegalTech', segment: 'legaltech', description: 'IA jurídica' }

describe('GeminiTopicQueryPlanner', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('parses and caps queries from the model response', async () => {
    respondWith(JSON.stringify({ queries: ['ai', 'legaltech', 'startups', 'tech', 'law', 'extra'] }))

    const result = await new GeminiTopicQueryPlanner('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).planQueries({
      business,
      recurringThemes: [],
      userId: 'user-1',
      brandId: 'brand-1',
    })

    expect(result).toEqual(['ai', 'legaltech', 'startups', 'tech', 'law'])
  })

  it('records AI usage with the topic-query-planning operation and the caller userId/brandId', async () => {
    respondWith(JSON.stringify({ queries: ['ai'] }))
    const usageRecorder = makeUsageRecorder()

    await new GeminiTopicQueryPlanner('p', 'global', 'gemini-2.5-flash', usageRecorder).planQueries({
      business,
      recurringThemes: [],
      userId: 'user-1',
      brandId: 'brand-1',
    })

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'text-generation',
        operation: 'topic-query-planning',
        model: 'gemini-2.5-flash',
      }),
    )
  })

  it('throws when the model returns no queries', async () => {
    respondWith(JSON.stringify({ queries: [] }))

    await expect(
      new GeminiTopicQueryPlanner('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).planQueries({
        business,
        recurringThemes: [],
        userId: 'user-1',
        brandId: 'brand-1',
      }),
    ).rejects.toThrow('malformed topic query planning payload')
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiTopicQueryPlanner('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).planQueries({
        business,
        recurringThemes: [],
        userId: 'user-1',
        brandId: 'brand-1',
      }),
    ).rejects.toThrow('invalid JSON for topic query planning')
  })
})
