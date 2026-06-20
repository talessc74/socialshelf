import type { PatternAnalyzerPort, PostPerformanceSummary, ProfileDiagnostic } from '@socialshelf/domain'

export class AnalyzePerformancePatternsUseCase {
  constructor(private readonly patternAnalyzer: PatternAnalyzerPort) {}

  async execute(entries: PostPerformanceSummary[]): Promise<ProfileDiagnostic> {
    if (entries.length === 0) {
      throw new Error('No published posts with metrics to analyze')
    }
    return this.patternAnalyzer.analyzePatterns(entries)
  }
}
