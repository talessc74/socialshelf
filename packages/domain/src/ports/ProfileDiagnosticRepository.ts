import type { ProfileDiagnostic } from './PatternAnalyzerPort.js'

export interface ProfileDiagnosticRecord {
  id: string
  brandId: string
  postsAnalyzed: number
  diagnostic: ProfileDiagnostic
  computedAt: Date
}

export interface ProfileDiagnosticRepository {
  save(record: ProfileDiagnosticRecord): Promise<void>
  findLatestByBrand(brandId: string): Promise<ProfileDiagnosticRecord | null>
}
