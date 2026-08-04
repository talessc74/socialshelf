import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { AiUsageRecorderPort, ArtifactPlan, ContentInputs } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiCopyGenerator } from './GeminiCopyGenerator.js'

function respondWith(payload: unknown) {
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) })
}

function makeInputs(overrides: Partial<ContentInputs> = {}): ContentInputs {
  return {
    userId: 'user-1',
    brandId: 'brand-1',
    description: 'Post de exemplo',
    images: [],
    targetPlatforms: [Platform.LINKEDIN],
    artifactPlan: { mode: 'fixed', count: 1 } as ArtifactPlan,
    pautaContext: null,
    brandBusiness: null,
    brandVoice: null,
    includeBodyText: false,
    ...overrides,
  }
}

function makeValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    copies: { [Platform.LINKEDIN]: { text: 'Legenda pronta', charCount: 14 } },
    cta: 'Saiba mais',
    headlines: ['Título'],
    visualBriefs: ['A cozy scene'],
    ...overrides,
  }
}

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn() }
}

describe('GeminiCopyGenerator', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('parses a well-formed copy from the model response', async () => {
    respondWith(makeValidPayload())

    const result = await new GeminiCopyGenerator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).generateCopy(
      makeInputs(),
    )

    expect(result.copies[Platform.LINKEDIN]).toEqual({ text: 'Legenda pronta', charCount: 14 })
    expect(result.cta).toBe('Saiba mais')
  })

  it('joins a platform text that comes back as an array of paragraphs instead of a single string', async () => {
    respondWith(
      makeValidPayload({
        copies: { [Platform.LINKEDIN]: { text: ['Primeiro parágrafo.', 'Segundo parágrafo.'], charCount: 999 } },
      }),
    )

    const result = await new GeminiCopyGenerator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).generateCopy(
      makeInputs(),
    )

    const linkedinCopy = result.copies[Platform.LINKEDIN]!
    expect(linkedinCopy.text).toBe('Primeiro parágrafo.\n\nSegundo parágrafo.')
    // charCount é sempre recalculado a partir do texto final, nunca herdado do modelo (que
    // mandou 999 para um texto de bem menos que isso).
    expect(linkedinCopy.charCount).toBe(linkedinCopy.text.length)
  })

  it('throws when a platform text is neither a string nor an array of strings', async () => {
    respondWith(makeValidPayload({ copies: { [Platform.LINKEDIN]: { text: 42, charCount: 2 } } }))

    await expect(
      new GeminiCopyGenerator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).generateCopy(makeInputs()),
    ).rejects.toThrow('malformed copy generation payload')
  })

  it('throws when the model response is missing required fields', async () => {
    respondWith({ cta: 'Saiba mais' })

    await expect(
      new GeminiCopyGenerator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).generateCopy(makeInputs()),
    ).rejects.toThrow('malformed copy generation payload')
  })

  it('throws when the model returns invalid JSON', async () => {
    generateContent.mockResolvedValueOnce({ text: 'not json at all' })

    await expect(
      new GeminiCopyGenerator('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).generateCopy(makeInputs()),
    ).rejects.toThrow('invalid JSON for copy generation')
  })
})
