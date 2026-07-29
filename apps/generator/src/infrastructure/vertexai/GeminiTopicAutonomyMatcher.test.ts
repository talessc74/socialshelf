import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TemplateStyle } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiTopicAutonomyMatcher } from './GeminiTopicAutonomyMatcher.js'

function respondWith(text: string) {
  generateContent.mockResolvedValueOnce({ text })
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

  it('short-circuits without calling the model when no topics and at most 1 style preference are configured', async () => {
    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: [],
      blockedTopics: [],
      stylePreferences: [TemplateStyle.BOLD_BOTTOM],
    })

    expect(result).toEqual({ blocked: false, autoPublishEligible: false, recommendedStyle: TemplateStyle.BOLD_BOTTOM })
    expect(generateContent).not.toHaveBeenCalled()
  })

  it('calls the model when more than 1 style preference is configured, even with no topics either way', async () => {
    respondWith(JSON.stringify({ blocked: false, autoPublishEligible: false, recommendedStyle: 'centered-overlay' }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: [],
      blockedTopics: [],
      stylePreferences: [TemplateStyle.BOLD_BOTTOM, TemplateStyle.CENTERED_OVERLAY],
    })

    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      blocked: false,
      autoPublishEligible: false,
      recommendedStyle: TemplateStyle.CENTERED_OVERLAY,
    })
  })

  it('parses blocked, autoPublishEligible and recommendedStyle from the model response', async () => {
    respondWith(JSON.stringify({ blocked: false, autoPublishEligible: true, recommendedStyle: 'top-strip' }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: ['Caso do Dia com resultado real do produto'],
      blockedTopics: ['política'],
      stylePreferences: [TemplateStyle.TOP_STRIP, TemplateStyle.NO_TEXT],
    })

    expect(result).toEqual({ blocked: false, autoPublishEligible: true, recommendedStyle: TemplateStyle.TOP_STRIP })
  })

  it('calls the model when only blockedTopics is configured', async () => {
    respondWith(JSON.stringify({ blocked: true, autoPublishEligible: false, recommendedStyle: 'bold-bottom' }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: [],
      blockedTopics: ['política'],
      stylePreferences: [TemplateStyle.BOLD_BOTTOM],
    })

    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ blocked: true, autoPublishEligible: false, recommendedStyle: TemplateStyle.BOLD_BOTTOM })
  })

  it('falls back to the first style preference when the model recommends a style outside the offered list', async () => {
    respondWith(JSON.stringify({ blocked: false, autoPublishEligible: false, recommendedStyle: 'no-text' }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: ['x'],
      blockedTopics: [],
      stylePreferences: [TemplateStyle.BOLD_BOTTOM, TemplateStyle.CENTERED_OVERLAY],
    })

    expect(result.recommendedStyle).toBe(TemplateStyle.BOLD_BOTTOM)
  })

  it('falls back to the first style preference when the model omits recommendedStyle entirely', async () => {
    respondWith(JSON.stringify({ blocked: false, autoPublishEligible: false }))

    const result = await new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
      topic,
      autoPublishTopics: ['x'],
      blockedTopics: [],
      stylePreferences: [TemplateStyle.TOP_STRIP, TemplateStyle.NO_TEXT],
    })

    expect(result.recommendedStyle).toBe(TemplateStyle.TOP_STRIP)
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(
      new GeminiTopicAutonomyMatcher('p', 'global', 'gemini-2.5-flash').classify({
        topic,
        autoPublishTopics: ['x'],
        blockedTopics: [],
        stylePreferences: [TemplateStyle.BOLD_BOTTOM],
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
        stylePreferences: [TemplateStyle.BOLD_BOTTOM],
      }),
    ).rejects.toThrow('malformed topic autonomy classification payload')
  })
})
