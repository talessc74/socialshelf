import type { Platform } from '../entities/Platform.js'
import type { PostMetrics } from './AnalyticsReaderPort.js'

export interface PostPerformanceSummary {
  platform: Platform
  text: string
  metrics: PostMetrics
  score: number
  publishedAt: Date
}

export interface ProfileDiagnosticChecklistItem {
  title: string
  description: string
}

export interface ProfileDiagnosticTheme {
  label: string
  strength: number
}

export interface ProfileDiagnosticActionStep {
  title: string
  description: string
}

export interface ProfileDiagnostic {
  niche: string
  diagnosisSummary: string
  viralPotential: number
  whatWorks: ProfileDiagnosticChecklistItem[]
  engagingThemes: ProfileDiagnosticTheme[]
  topFormats: string[]
  bestTimes: string[]
  engagementAnalysis: string
  actionPlan: ProfileDiagnosticActionStep[]
}

export interface PatternAnalyzerPort {
  // userId/brandId: atribuição de custo de IA (Fase 0 de billing) — quem pagou por esta chamada.
  analyzePatterns(entries: PostPerformanceSummary[], userId: string, brandId: string): Promise<ProfileDiagnostic>
}
