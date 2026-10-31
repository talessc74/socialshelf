import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AiUsageRecorderPort, ProfileDiagnostic } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiPerformanceSuggester } from './GeminiPerformanceSuggester.js'

function respondWith(payload: unknown) {
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) })
}

function makeUsageRecorder(): AiUsageRecorderPort {
  return { record: vi.fn().mockResolvedValue(undefined) }
}

const diagnostic: ProfileDiagnostic = {
  niche: 'Tecnologia',
  diagnosisSummary: 'Resumo',
  viralPotential: 50,
  whatWorks: [],
  engagingThemes: [{ label: 'IA', strength: 80 }],
  topFormats: ['CAROUSEL_ALBUM'],
  bestTimes: ['08:00'],
  engagementAnalysis: 'análise',
  actionPlan: [{ title: 'ação', description: 'desc' }],
}

const validSuggestion = {
  headline: 'Ideia de post',
  rationale: 'Por que funciona',
  viralScore: 70,
  basedOnThemes: ['IA'],
  bestTimeToPost: 'Quintas à noite',
  bestTimeWeekdays: [4],
  bestTimeHourStart: 18,
  bestTimeHourEnd: 21,
}

describe('GeminiPerformanceSuggester', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('parses well-formed suggestions from the model response', async () => {
    respondWith({ suggestions: [validSuggestion] })

    const result = await new GeminiPerformanceSuggester(
      'p',
      'global',
      'gemini-2.5-flash',
      makeUsageRecorder(),
    ).suggestPosts(diagnostic, 'user-1', 'brand-1')

    expect(result).toEqual([validSuggestion])
  })

  it('records AI usage with the performance-suggestion operation and the caller userId/brandId', async () => {
    respondWith({ suggestions: [validSuggestion] })
    const usageRecorder = makeUsageRecorder()

    await new GeminiPerformanceSuggester('p', 'global', 'gemini-2.5-flash', usageRecorder).suggestPosts(
      diagnostic,
      'user-1',
      'brand-1',
    )

    expect(usageRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        brandId: 'brand-1',
        category: 'text-generation',
        operation: 'performance-suggestion',
        model: 'gemini-2.5-flash',
      }),
    )
  })

  it('throws when the model response does not match the expected shape', async () => {
    respondWith({ suggestions: [{ headline: 'x' }] })

    await expect(
      new GeminiPerformanceSuggester('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).suggestPosts(
        diagnostic,
        'user-1',
        'brand-1',
      ),
    ).rejects.toThrow("don't match the expected shape")
  })

  it('throws when the model returns invalid JSON', async () => {
    generateContent.mockResolvedValueOnce({ text: 'not json at all' })

    await expect(
      new GeminiPerformanceSuggester('p', 'global', 'gemini-2.5-flash', makeUsageRecorder()).suggestPosts(
        diagnostic,
        'user-1',
        'brand-1',
      ),
    ).rejects.toThrow('invalid JSON for performance suggestions')
  })
})
