import type { ProfileDiagnostic } from './PatternAnalyzerPort.js'

export interface ProfileDiagnosticRecord {
  id: string
  brandId: string
  postsAnalyzed: number
  diagnostic: ProfileDiagnostic
  computedAt: Date
}

export interface ProfileDiagnosticRepository {
  save(userId: string, record: ProfileDiagnosticRecord): Promise<void>
  findLatestByBrand(userId: string, brandId: string): Promise<ProfileDiagnosticRecord | null>
}
