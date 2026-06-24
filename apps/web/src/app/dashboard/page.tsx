'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Send, Clock, Lightbulb, BarChart3, Share2, Tag } from 'lucide-react'
import { Platform } from '@socialshelf/domain'
import { api } from '../../lib/api'
import { LogoImage } from '../../components/LogoImage'
import { NewsCarousel } from '../../components/NewsCarousel'
import { useAuth } from '../../contexts/AuthContext'

const TOTAL_PLATFORMS = 4
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.LINKEDIN]: '#0c4a6e',
  [Platform.FACEBOOK]: '#0369a1',
  [Platform.INSTAGRAM]: '#38bdf8',
  [Platform.TWITTER]: '#bae6fd',
}

const SHORTCUTS = [
  { href: '/dashboard/generate', label: 'Gerar com IA', description: 'Crie posts com inteligência artificial', icon: Sparkles },
  { href: '/dashboard/compose', label: 'Novo Post', description: 'Escreva e publique manualmente', icon: Send },
  { href: '/dashboard/scheduled', label: 'Posts Agendados', description: 'Veja e edite os posts programados', icon: Clock },
  { href: '/dashboard/insights', label: 'Banco de Insights', description: 'Ideias de posts sugeridas pela IA', icon: Lightbulb },
  { href: '/dashboard/performance', label: 'Performance', description: 'Veja o que está funcionando', icon: BarChart3 },
  { href: '/dashboard/accounts', label: 'Central de Contas', description: 'Gerencie as redes sociais conectadas', icon: Share2 },
  { href: '/dashboard/brand', label: 'Marca', description: 'Identidade e voz da marca', icon: Tag },
]

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data: brandProfile } = useQuery({
    queryKey: ['brand-profile'],
    queryFn: () => api.getBrandProfile(),
  })

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api.getConnections(),
  })

  const { data: performance } = useQuery({
    queryKey: ['posts-performance'],
    queryFn: () => api.getPostsPerformance(),
  })

  const { data: suggestions } = useQuery({
    queryKey: ['performance-suggestions'],
    queryFn: () => api.getPerformanceSuggestions(),
  })

  const { data: scheduledPosts } = useQuery({
    queryKey: ['posts', 'scheduled'],
    queryFn: () => api.getPosts('scheduled'),
  })

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      const platforms = connected.split(',').join(', ')
      setNotice({ type: 'success', message: `Conectado com sucesso: ${platforms}` })
      router.replace('/dashboard')
    } else if (error) {
      const detail = searchParams.get('detail')
      setNotice({ type: 'error', message: `Falha ao conectar plataforma. Tente novamente.${detail ? ` [${detail}]` : ''}` })
      router.replace('/dashboard')
    }
  }, [searchParams, router])

  const entries = useMemo(() => performance?.entries ?? [], [performance])
  const connectionsCount = useMemo(() => new Set(connections?.map((c) => c.platform)).size, [connections])
  const freshSuggestionsCount = useMemo(() => suggestions?.filter((s) => !s.shelved).length ?? 0, [suggestions])

  const totals = entries.reduce(
    (acc, e) => ({
      impressions: acc.impressions + e.metrics.impressions,
      engagements: acc.engagements + e.metrics.likes + e.metrics.comments + e.metrics.shares,
    }),
    { impressions: 0, engagements: 0 },
  )

  const engagementRate = entries.length > 0 ? totals.engagements / Math.max(totals.impressions, 1) : 0
  const impressionsUnavailable = entries.length > 0 && totals.impressions === 0

  const engagementByPlatform = useMemo(() => {
    const map = new Map<Platform, number>()
    for (const e of entries) {
      map.set(e.platform, (map.get(e.platform) ?? 0) + e.metrics.likes + e.metrics.comments + e.metrics.shares)
    }
    const totalEngagements = [...map.values()].reduce((sum, v) => sum + v, 0)
    return [...map.entries()]
      .map(([platform, engagements]) => ({
        platform,
        engagements,
        share: totalEngagements > 0 ? engagements / totalEngagements : 0,
      }))
      .sort((a, b) => b.engagements - a.engagements)
  }, [entries])

  const impressionsByWeekday = useMemo(() => {
    const buckets = new Array(7).fill(0)
    for (const e of entries) buckets[new Date(e.publishedAt).getDay()] += e.metrics.impressions
    const max = Math.max(...buckets, 1)
    return buckets.map((value) => ({ value, ratio: value / max }))
  }, [entries])

  const checklist = [
    { label: 'Conectar uma rede social', done: connectionsCount > 0, href: '/dashboard/accounts' },
    { label: 'Configurar identidade de marca', done: !!brandProfile, href: '/dashboard/brand' },
    { label: 'Publicar seu primeiro post', done: entries.length > 0, href: '/dashboard/compose' },
    { label: 'Conectar todas as redes', done: connectionsCount >= TOTAL_PLATFORMS, href: '/dashboard/accounts' },
  ]
  const doneCount = checklist.filter((c) => c.done).length

  const shortcutBadges: Record<string, string> = {
    '/dashboard/scheduled': scheduledPosts ? `${scheduledPosts.length} agendado${scheduledPosts.length === 1 ? '' : 's'}` : '',
    '/dashboard/insights': freshSuggestionsCount > 0 ? `${freshSuggestionsCount} nova${freshSuggestionsCount === 1 ? '' : 's'}` : '',
    '/dashboard/accounts': `${connectionsCount}/${TOTAL_PLATFORMS} conectadas`,
    '/dashboard/brand': brandProfile ? 'Configurada' : 'Pendente',
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            notice.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {notice.message}
          <button onClick={() => setNotice(null)} className="ml-4 text-xs underline opacity-70">
            Fechar
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting()}, <span className="text-brand-600">{user?.email?.split('@')[0] ?? 'bem-vindo'}</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">Sua central para criar e acompanhar posts com a SocialShelf.</p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <StatPill label="Contas" value={`${connectionsCount}/${TOTAL_PLATFORMS}`} tone="dark" />
          <StatPill label="Posts medidos" value={String(entries.length)} tone="gold" />
          <StatPill label="Engajamento" value={`${(engagementRate * 100).toFixed(1)}%`} tone="outline" />
        </div>
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <BigStat icon={Share2} value={connectionsCount} label="Contas conectadas" />
          <BigStat icon={BarChart3} value={entries.length} label="Posts publicados" />
          <BigStat icon={Sparkles} value={totals.impressions} label="Impressões totais" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {brandProfile?.visual.logoStoragePath ? (
            <LogoImage path={brandProfile.visual.logoStoragePath} className="h-28 w-full rounded-xl border border-gray-100" />
          ) : (
            <div className="flex h-28 w-full items-center justify-center rounded-xl bg-brand-50 text-3xl font-bold text-brand-700">
              {(user?.email?.[0] ?? 'S').toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{brandProfile?.business.name ?? 'Sua marca'}</p>
            <p className="text-sm text-gray-500">{brandProfile?.business.segment ?? 'Configure sua identidade'}</p>
          </div>
          <Link
            href="/dashboard/brand"
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
          >
            <Tag className="h-3.5 w-3.5" /> Configurar marca
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-gray-900">Impressões na semana</p>
            <span className="text-xs text-gray-400">por dia da publicação</span>
          </div>
          {impressionsUnavailable ? (
            <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
              <p className="text-xs text-gray-500">Nenhuma rede conectada reportou impressões para os posts medidos.</p>
              <p className="text-xs text-gray-400">O LinkedIn não disponibiliza esse dado para perfis pessoais.</p>
            </div>
          ) : (
            <div className="flex h-32 items-end justify-between gap-2">
              {impressionsByWeekday.map((bucket, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="relative w-full"
                    style={{ height: `${Math.max(bucket.ratio * 88, 4)}%` }}
                  >
                    <span className="absolute -top-4 left-0 right-0 text-center text-[11px] font-medium text-gray-500">
                      {bucket.value}
                    </span>
                    <div className={`h-full w-full rounded-md ${bucket.value > 0 ? 'bg-brand-500' : 'bg-gray-100'}`} />
                  </div>
                  <span className="text-xs text-gray-400">{WEEKDAY_LABELS[i]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="self-start font-semibold text-gray-900">Taxa de engajamento</p>
          <EngagementGauge
            segments={engagementByPlatform.map((p) => ({ share: p.share, color: PLATFORM_COLORS[p.platform] }))}
          />
          <p className="text-2xl font-bold text-gray-900">{(engagementRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">média dos posts medidos</p>
          {engagementByPlatform.length > 1 && (
            <ul className="mt-1 w-full space-y-1 self-stretch">
              {engagementByPlatform.map((p) => (
                <li key={p.platform} className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PLATFORM_COLORS[p.platform] }}
                    />
                    {PLATFORM_LABELS[p.platform]}
                  </span>
                  <span className="font-semibold text-gray-700">{(p.share * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {doneCount < checklist.length && (
          <div className="rounded-2xl bg-gray-900 p-5 text-white shadow-sm lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">Primeiros passos</p>
              <span className="text-sm text-brand-300">{doneCount}/{checklist.length}</span>
            </div>
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                        item.done ? 'bg-brand-400 text-gray-900' : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {item.done ? '✓' : ''}
                    </span>
                    <span className={item.done ? 'text-white/60 line-through' : 'text-white'}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${doneCount === checklist.length ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900">
              <Lightbulb className="h-4 w-4 text-brand-600" /> Sugestões para a próxima publicação
            </p>
            <Link href="/dashboard/insights" className="text-xs font-semibold text-brand-700 hover:underline">
              Ver todas
            </Link>
          </div>
          {suggestions && suggestions.length > 0 ? (
            <ul className="space-y-3">
              {suggestions.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{s.headline}</p>
                    <p className="text-xs text-gray-400">{s.bestTimeToPost}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    score {s.viralScore.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma sugestão disponível ainda. Conecte suas redes para começar.</p>
          )}
        </div>
      </section>

      <NewsCarousel />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ href, label, description, icon: Icon }) => {
            const badge = shortcutBadges[href]
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:border-brand-300 hover:shadow-brand-100/60"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  {badge && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                      {badge}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: 'dark' | 'gold' | 'outline' }) {
  const toneClass =
    tone === 'dark'
      ? 'bg-gray-900 text-white'
      : tone === 'gold'
        ? 'bg-brand-400 text-gray-900'
        : 'border border-gray-200 text-gray-700'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${toneClass}`}>
      {value}
      <span className="text-xs font-medium opacity-70">{label}</span>
    </span>
  )
}

function BigStat({ icon: Icon, value, label }: { icon: typeof Sparkles; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-lg font-bold text-gray-900">{value.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  )
}

function EngagementGauge({ segments }: { segments: Array<{ share: number; color: string }> }) {
  let acc = 0
  const stops = segments
    .filter((s) => s.share > 0)
    .map((s) => {
      const start = acc * 360
      acc += s.share
      return `${s.color} ${start}deg ${acc * 360}deg`
    })
  const background = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#f3f4f6'
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background }}>
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white" />
    </div>
  )
}
