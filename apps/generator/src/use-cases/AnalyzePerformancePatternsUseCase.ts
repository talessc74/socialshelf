import { randomUUID } from 'node:crypto'
import type {
  PatternAnalyzerPort,
  PostPerformanceSummary,
  ProfileDiagnostic,
  ProfileDiagnosticRepository,
} from '@socialshelf/domain'

export class AnalyzePerformancePatternsUseCase {
  constructor(
    private readonly patternAnalyzer: PatternAnalyzerPort,
    private readonly diagnosticRepo: ProfileDiagnosticRepository,
  ) {}

  async execute(brandId: string, entries: PostPerformanceSummary[]): Promise<ProfileDiagnostic> {
    if (entries.length === 0) {
      throw new Error('No published posts with metrics to analyze')
    }

    const diagnostic = await this.patternAnalyzer.analyzePatterns(entries)

    await this.diagnosticRepo.save({
      id: randomUUID(),
      brandId,
      postsAnalyzed: entries.length,
      diagnostic,
      computedAt: new Date(),
    })

    return diagnostic
  }
}
