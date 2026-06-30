import type { ApiPostPerformanceEntry } from '../lib/api'

interface EngagementOverTimeChartProps {
  entries: ApiPostPerformanceEntry[]
  avgEngagementRate: number | null
}

const WIDTH = 600
const HEIGHT = 140
const PADDING_X = 10
const PADDING_Y = 16

export function EngagementOverTimeChart({ entries, avgEngagementRate }: EngagementOverTimeChartProps) {
  const points = entries
    .map((entry) => ({
      publishedAt: new Date(entry.publishedAt),
      rate:
        (entry.metrics.likes + entry.metrics.comments + entry.metrics.shares) /
        Math.max(entry.metrics.impressions, 1),
    }))
    .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())

  if (points.length === 0) return null

  const maxRate = Math.max(...points.map((p) => p.rate), 0.01)
  const stepX = points.length > 1 ? (WIDTH - PADDING_X * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => ({
    ...p,
    x: PADDING_X + i * stepX,
    y: HEIGHT - PADDING_Y - (p.rate / maxRate) * (HEIGHT - PADDING_Y * 2),
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-muted">📊 Engajamento ao longo do tempo</p>
        {avgEngagementRate !== null && (
          <p className="text-xs font-semibold text-ink">
            Média: {(avgEngagementRate * 100).toFixed(1)}%
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-28 w-full overflow-visible" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} className="text-accent" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} className="fill-accent">
            <title>
              {c.publishedAt.toLocaleDateString('pt-BR')}: {(c.rate * 100).toFixed(1)}%
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-2">
        <span>{coords[0]!.publishedAt.toLocaleDateString('pt-BR')}</span>
        {coords.length > 1 && <span>{coords[coords.length - 1]!.publishedAt.toLocaleDateString('pt-BR')}</span>}
      </div>
    </div>
  )
}
