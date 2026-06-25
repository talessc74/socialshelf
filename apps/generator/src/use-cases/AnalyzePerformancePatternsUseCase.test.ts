import { describe, it, expect, vi } from 'vitest'
import { AnalyzePerformancePatternsUseCase } from './AnalyzePerformancePatternsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  PatternAnalyzerPort,
  PostPerformanceSummary,
  ProfileDiagnostic,
  ProfileDiagnosticRepository,
} from '@socialshelf/domain'

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

function makeDiagnosticRepo(): ProfileDiagnosticRepository {
  return {
    save: vi.fn(),
    findLatestByBrand: vi.fn(),
  }
}

describe('AnalyzePerformancePatternsUseCase', () => {
  it('retorna o diagnóstico gerado pelo analisador', async () => {
    const diagnostic = makeDiagnostic()
    const patternAnalyzer: PatternAnalyzerPort = {
      analyzePatterns: vi.fn().mockResolvedValue(diagnostic),
    }
    const diagnosticRepo = makeDiagnosticRepo()
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer, diagnosticRepo)

    const result = await useCase.execute('brand-1', [makeEntry()])

    expect(result).toEqual(diagnostic)
    expect(patternAnalyzer.analyzePatterns).toHaveBeenCalledWith([makeEntry()])
  })

  it('persiste o diagnóstico com a marca, a contagem de posts e o horário do cálculo', async () => {
    const diagnostic = makeDiagnostic()
    const patternAnalyzer: PatternAnalyzerPort = {
      analyzePatterns: vi.fn().mockResolvedValue(diagnostic),
    }
    const diagnosticRepo = makeDiagnosticRepo()
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer, diagnosticRepo)

    await useCase.execute('brand-1', [makeEntry(), makeEntry()])

    expect(diagnosticRepo.save).toHaveBeenCalledWith(
      'brand-1',
      expect.objectContaining({
        brandId: 'brand-1',
        postsAnalyzed: 2,
        diagnostic,
        computedAt: expect.any(Date),
      }),
    )
  })

  it('lança erro quando não há posts para analisar', async () => {
    const patternAnalyzer: PatternAnalyzerPort = { analyzePatterns: vi.fn() }
    const diagnosticRepo = makeDiagnosticRepo()
    const useCase = new AnalyzePerformancePatternsUseCase(patternAnalyzer, diagnosticRepo)

    await expect(useCase.execute('brand-1', [])).rejects.toThrow('No published posts with metrics to analyze')
    expect(patternAnalyzer.analyzePatterns).not.toHaveBeenCalled()
    expect(diagnosticRepo.save).not.toHaveBeenCalled()
  })
})
