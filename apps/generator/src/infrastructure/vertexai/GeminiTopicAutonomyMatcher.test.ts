import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContent = vi.fn()

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
  })),
}))

import { GeminiTopicAutonomyMatcher } from './GeminiTopicAutonomyMatcher.js'

function respondWith(text: string) {
  generateContent.mockResolvedValueOnce({
    response: { candidates: [{ content: { parts: [{ text }] } }] },
  })
}

const topic = {
  headline: 'Cliente relata resultado real com o produto',
  summary: 'Depoimento de cliente sobre ganho de eficiência',
  rationale: 'Case de sucesso alinhado ao segmento da marca',
}

describe('GeminiTopicAutonomyMatcher', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('short-circuits without calling the model when no topics are configured either way', async () => {
    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: [],
      blockedTopics: [],
    })

    expect(result).toEqual({ blocked: false, autoPublishEligible: false })
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('parses blocked and autoPublishEligible from the model response', async () => {
    respondWith(JSON.stringify({ blocked: false, autoPublishEligible: true }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: ['Caso do Dia com resultado real do produto'],
      blockedTopics: ['política'],
    })

    expect(result).toEqual({ blocked: false, autoPublishEligible: true })
  })

  it('calls the model when only blockedTopics is configured', async () => {
    respondWith(JSON.stringify({ blocked: true, autoPublishEligible: false }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: [],
      blockedTopics: ['política'],
    })

    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ blocked: true, autoPublishEligible: false })
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
        topic,
        autoPublishTopics: ['x'],
        blockedTopics: [],
      }),
    ).rejects.toThrow('invalid JSON for topic autonomy classification')
  })

  it('throws when the model response is missing the expected boolean fields', async () => {
    respondWith(JSON.stringify({ blocked: 'no' }))

    await expect(
      new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
        topic,
        autoPublishTopics: ['x'],
        blockedTopics: [],
      }),
    ).rejects.toThrow('malformed topic autonomy classification payload')
  })
})
