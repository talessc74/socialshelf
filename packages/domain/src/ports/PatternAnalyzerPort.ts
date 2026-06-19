import type { Platform } from '../entities/Platform.js'
import type { PostMetrics } from './AnalyticsReaderPort.js'

export interface PostPerformanceSummary {
  platform: Platform
  text: string
  metrics: PostMetrics
  score: number
}

export interface PatternAnalyzerPort {
  analyzePatterns(entries: PostPerformanceSummary[]): Promise<string>
}
