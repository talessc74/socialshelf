import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type { PostPerformanceSummary } from '@socialshelf/domain'

const generateContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}))

import { GeminiPatternAnalyzer } from './GeminiPatternAnalyzer.js'

function respondWith(payload: unknown) {
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(payload) })
}

function makeEntry(overrides: Partial<PostPerformanceSummary> = {}): PostPerformanceSummary {
  return {
    platform: Platform.LINKEDIN,
    text: 'Post de exemplo',
    metrics: { impressions: 100, likes: 10, comments: 2, shares: 1 },
    score: 113,
    publishedAt: new Date('2026-07-06T17:30:00.000Z'),
    ...overrides,
  }
}

function makeValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    niche: 'Tecnologia',
    diagnosisSummary: 'Os posts sobre IA performam melhor.',
    viralPotential: 45,
    whatWorks: [{ title: 'Proposta clara', description: 'Os posts comunicam bem o valor.' }],
    engagingThemes: [{ label: 'IA aplicada', strength: 80 }],
    topFormats: ['CAROUSEL_ALBUM'],
    bestTimes: ['08:00'],
    engagementAnalysis: 'Mais curtidas que comentários.',
    actionPlan: [{ title: 'Crie CTAs', description: 'Peça comentários ao final do post.' }],
    ...overrides,
  }
}

describe('GeminiPatternAnalyzer', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('parses a well-formed diagnostic from the model response', async () => {
    respondWith(makeValidPayload())

    const result = await new GeminiPatternAnalyzer('p', 'global', 'gemini-2.5-flash').analyzePatterns([
      makeEntry(),
    ])

    expect(result.niche).toBe('Tecnologia')
    expect(result.bestTimes).toEqual(['08:00'])
  })

  it('includes each post\'s publish time (Brasília) in the prompt so bestTimes has real data to work from', async () => {
    respondWith(makeValidPayload())

    await new GeminiPatternAnalyzer('p', 'global', 'gemini-2.5-flash').analyzePatterns([
      makeEntry({ publishedAt: new Date('2026-07-06T17:30:00.000Z') }),
    ])

    const prompt = (generateContent.mock.calls[0]![0] as { contents: string }).contents
    // 17:30 UTC no domingo 2026-07-06 é 14:30 em horário de Brasília (UTC-3).
    expect(prompt).toContain('14:30')
    expect(prompt).toContain('horário de Brasília')
  })

  it('normalizes bestTimes into an array when the model returns a single string', async () => {
    respondWith(makeValidPayload({ bestTimes: '08:00, 14:00' }))

    const result = await new GeminiPatternAnalyzer('p', 'global', 'gemini-2.5-flash').analyzePatterns([
      makeEntry(),
    ])

    expect(result.bestTimes).toEqual(['08:00', '14:00'])
  })

  it('normalizes topFormats into an array when the model returns a single string', async () => {
    respondWith(makeValidPayload({ topFormats: 'IMAGE' }))

    const result = await new GeminiPatternAnalyzer('p', 'global', 'gemini-2.5-flash').analyzePatterns([
      makeEntry(),
    ])

    expect(result.topFormats).toEqual(['IMAGE'])
  })

  it('throws when the model response is missing required fields', async () => {
    respondWith({ niche: 'Tecnologia' })

    await expect(
      new GeminiPatternAnalyzer('p', 'global', 'gemini-2.5-flash').analyzePatterns([makeEntry()]),
    ).rejects.toThrow("doesn't match the expected shape")
  })

  it('throws when the model returns invalid JSON', async () => {
    generateContent.mockResolvedValueOnce({ text: 'not json at all' })

    await expect(
      new GeminiPatternAnalyzer('p', 'global', 'gemini-2.5-flash').analyzePatterns([makeEntry()]),
    ).rejects.toThrow('invalid JSON for pattern analysis')
  })
})
