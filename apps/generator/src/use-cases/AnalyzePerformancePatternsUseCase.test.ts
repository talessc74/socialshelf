import { describe, it, expect, vi } from 'vitest'
import { AnalyzePerformancePatternsUseCase } from './AnalyzePerformancePatternsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { PatternAnalyzerPort, PostPerformanceSummary, ProfileDiagnostic } from '@socialshelf/domain'

function makeEntry(overrides: Partial<PostPerformanceSummary> = {}): PostPerformanceSummary {
  return {
    platform: Platform.LINKEDIN,
    text: 'Post de exemplo',
    metrics: { impressions: 100, likes: 10, comments: 2, shares: 1 },
    score: 113,
    ...overrides,
  }
}

function makeDiagnostic(overrides: Partial<ProfileDiagnostic> = {}): ProfileDiagnostic {
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

describe('AnalyzePerformancePatternsUseCase', () => {
  it('retorna o diagnóstico gerado pelo analisador', async () => {
    const diagnostic = makeDiagnostic()
    const patternAnalyzer: PatternAnalyzerPort = {
      analyzePatterns: vi.fn().mockResolvedValue(diagnostic),
    }
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer)

    const result = await useCase.execute([makeEntry()])

    expect(result).toEqual(diagnostic)
    expect(patternAnalyzer.analyzePatterns).toHaveBeenCalledWith([makeEntry()])
  })

  it('lança erro quando não há posts para analisar', async () => {
    const patternAnalyzer: PatternAnalyzerPort = { analyzePatterns: vi.fn() }
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer)

    await expect(useCase.execute([])).rejects.toThrow('No published posts with metrics to analyze')
    expect(patternAnalyzer.analyzePatterns).not.toHaveBeenCalled()
  })
})
