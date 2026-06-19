import { describe, it, expect, vi } from 'vitest'
import { AnalyzePerformancePatternsUseCase } from './AnalyzePerformancePatternsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { PatternAnalyzerPort, PostPerformanceSummary } from '@socialshelf/domain'

function makeEntry(overrides: Partial<PostPerformanceSummary> = {}): PostPerformanceSummary {
  return {
    platform: Platform.LINKEDIN,
    text: 'Post de exemplo',
    metrics: { impressions: 100, likes: 10, comments: 2, shares: 1 },
    score: 113,
    ...overrides,
  }
}

describe('AnalyzePerformancePatternsUseCase', () => {
  it('retorna o texto de insights gerado pelo analisador', async () => {
    const patternAnalyzer: PatternAnalyzerPort = {
      analyzePatterns: vi.fn().mockResolvedValue('Os posts sobre IA performam melhor.'),
    }
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer)

    const result = await useCase.execute([makeEntry()])

    expect(result).toBe('Os posts sobre IA performam melhor.')
    expect(patternAnalyzer.analyzePatterns).toHaveBeenCalledWith([makeEntry()])
  })

  it('lança erro quando não há posts para analisar', async () => {
    const patternAnalyzer: PatternAnalyzerPort = { analyzePatterns: vi.fn() }
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer)

    await expect(useCase.execute([])).rejects.toThrow('No published posts with metrics to analyze')
    expect(patternAnalyzer.analyzePatterns).not.toHaveBeenCalled()
  })
})
