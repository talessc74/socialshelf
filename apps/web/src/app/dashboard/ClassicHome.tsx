'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, Send, Clock, Lightbulb, BarChart3, Share2, Tag, Newspaper, Bookmark } from 'lucide-react'
import { Platform } from '@socialshelf/domain'
import { api } from '../../lib/api'
import { LogoImage } from '../../components/LogoImage'
import { NewsCarousel } from '../../components/NewsCarousel'
import { SavedForLaterCarousel } from '../../components/SavedForLaterCarousel'
import { useAuth } from '../../contexts/AuthContext'
import { getTimeSavedTotal, formatMinutes } from '../../lib/selfieTimeSaved'
import { useSelfieNarrateOnReady } from '../../contexts/AssistantContext'

const TOTAL_PLATFORMS = 4
const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.LINKEDIN]: '#0c4a6e',
  [Platform.FACEBOOK]: '#0369a1',
  [Platform.INSTAGRAM]: '#38bdf8',
  [Platform.TWITTER]: '#bae6fd',
  [Platform.TIKTOK]: '#000000',
}

// Mesmo trio de níveis de autonomyLevel já configurável em /dashboard/brand — aqui só
// exibido, não editável, com o badge servindo de atalho pra tela onde dá pra mudar.
const AUTONOMY_BADGE: Record<'manual' | 'semi-automatic' | 'automatic', { label: string; hint: string; className: string }> = {
  manual: { label: '✋ Manual', hint: 'você publica cada post', className: 'bg-card-2 text-ink' },
  'semi-automatic': {
    label: '🧑‍💻 Semi-automático',
    hint: 'IA prepara, você aprova antes',
    className: 'bg-sky-50 text-sky-700',
  },
  automatic: { label: '🤖 Automático', hint: 'IA cria e publica sozinha', className: 'bg-violet-50 text-violet-700' },
}

const SHORTCUTS = [
  { href: '/dashboard/generate', label: 'Gerar com IA', description: 'Crie posts com inteligência artificial', icon: Sparkles },
  { href: '/dashboard/compose', label: 'Novo Post', description: 'Escreva e publique manualmente', icon: Send },
  { href: '/dashboard/scheduled', label: 'Posts Agendados', description: 'Veja e edite os posts programados', icon: Clock },
  { href: '/dashboard/insights', label: 'Banco de Insights', description: 'Ideias de posts sugeridas pela IA', icon: Lightbulb },
  { href: '/dashboard/insights?tab=news', label: 'Notícias', description: 'Veja notícias para criar pautas', icon: Newspaper },
  { href: '/dashboard/saved-for-later', label: 'Guardados Para Depois', description: 'Sugestões e rascunhos que você deixou de lado', icon: Bookmark },
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

export function ClassicHome() {
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

  const { data: shelvedSuggestions } = useQuery({
    queryKey: ['shelved-performance-suggestions'],
    queryFn: () => api.getShelvedPerformanceSuggestions(),
  })

  const { data: savedForLaterPosts } = useQuery({
    queryKey: ['posts', 'saved-for-later'],
    queryFn: () => api.getSavedForLaterPosts(),
  })

  // Total acumulado de tempo economizado (mesma chave localStorage do medidor
  // da tela de geração) — lido só no cliente (useEffect) para não divergir
  // entre SSR e hidratação. Sem histórico ainda, sem mensagem.
  const [timeSavedMessage, setTimeSavedMessage] = useState<string | null>(null)
  useEffect(() => {
    const total = getTimeSavedTotal()
    if (total > 0) {
      setTimeSavedMessage(`Você já economizou ${formatMinutes(total)} no total usando o SocialShelf!`)
    }
  }, [])
  useSelfieNarrateOnReady(timeSavedMessage)

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      const platforms = connected.split(',').join(', ')
      // metaNote=no-instagram: o Facebook conectou, mas a Página não tem Instagram Business/Creator
      // vinculado — avisa explícito em vez de deixar o usuário achar que o Instagram entrou junto.
      const noInstagram = searchParams.get('metaNote') === 'no-instagram'
      setNotice(
        noInstagram
          ? {
              type: 'error',
              message:
                `Conectado com sucesso: ${platforms}. O Instagram NÃO foi conectado: a Página do Facebook escolhida não tem uma conta ` +
                'Instagram Business ou Creator vinculada. Para publicar no Instagram, transforme a conta em Business/Creator e ' +
                'vincule-a a essa Página nas configurações do Instagram, depois reconecte aqui.',
            }
          : { type: 'success', message: `Conectado com sucesso: ${platforms}` },
      )
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

  const savedForLaterCount = (shelvedSuggestions?.length ?? 0) + (savedForLaterPosts?.length ?? 0)

  const shortcutBadges: Record<string, string> = {
    '/dashboard/scheduled': scheduledPosts ? `${scheduledPosts.length} agendado${scheduledPosts.length === 1 ? '' : 's'}` : '',
    '/dashboard/insights': freshSuggestionsCount > 0 ? `${freshSuggestionsCount} nova${freshSuggestionsCount === 1 ? '' : 's'}` : '',
    '/dashboard/saved-for-later': savedForLaterCount > 0 ? `${savedForLaterCount} guardado${savedForLaterCount === 1 ? '' : 's'}` : '',
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {greeting()}, <span className="text-accent">{user?.email?.split('@')[0] ?? 'bem-vindo'}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Sua central para criar e acompanhar posts com a SocialShelf.</p>
        </div>
        {brandProfile && (
          <Link
            href="/dashboard/brand"
            title="Como sua conta está publicando agora — clique para alterar"
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90 ${AUTONOMY_BADGE[brandProfile.operation.autonomyLevel].className}`}
          >
            {AUTONOMY_BADGE[brandProfile.operation.autonomyLevel].label}
            <span className="text-xs font-normal opacity-70">
              {AUTONOMY_BADGE[brandProfile.operation.autonomyLevel].hint}
            </span>
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card">
          {brandProfile?.visual.logoStoragePath ? (
            <LogoImage
              path={brandProfile.visual.logoStoragePath}
              fit="contain"
              className="h-28 w-full rounded-xl border border-line bg-card-2"
            />
          ) : (
            <div className="flex h-28 w-full items-center justify-center rounded-xl bg-accent-soft text-3xl font-bold text-accent">
              {(user?.email?.[0] ?? 'S').toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-ink">{brandProfile?.business.name ?? 'Sua marca'}</p>
            <p className="text-sm text-muted">{brandProfile?.business.segment ?? 'Configure sua identidade'}</p>
          </div>
          <Link
            href="/dashboard/brand"
            className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-contrast px-4 py-2 text-xs font-semibold text-contrast-ink hover:opacity-90"
          >
            <Tag className="h-3.5 w-3.5" /> Configurar marca
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold text-ink">Impressões na semana</p>
            <span className="text-xs text-muted">por dia da publicação</span>
          </div>
          {impressionsUnavailable ? (
            <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
              <p className="text-xs text-muted">Nenhuma rede conectada reportou impressões para os posts medidos.</p>
              <p className="text-xs text-muted">O LinkedIn não disponibiliza esse dado para perfis pessoais.</p>
            </div>
          ) : (
            <div className="flex h-32 items-end justify-between gap-2">
              {impressionsByWeekday.map((bucket, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="relative w-full"
                    style={{ height: `${Math.max(bucket.ratio * 88, 4)}%` }}
                  >
                    <span className="absolute -top-4 left-0 right-0 text-center text-[11px] font-medium text-muted">
                      {bucket.value}
                    </span>
                    <div className={`h-full w-full rounded-md ${bucket.value > 0 ? 'bg-accent' : 'bg-card-2'}`} />
                  </div>
                  <span className="text-xs text-muted">{WEEKDAY_LABELS[i]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card p-5 shadow-card">
          <p className="self-start font-semibold text-ink">Taxa de engajamento</p>
          <EngagementGauge
            segments={engagementByPlatform.map((p) => ({ share: p.share, color: PLATFORM_COLORS[p.platform] }))}
          />
          <p className="text-2xl font-bold text-ink">{(engagementRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-muted">média dos posts medidos</p>
          {engagementByPlatform.length > 1 && (
            <ul className="mt-1 w-full space-y-1 self-stretch">
              {engagementByPlatform.map((p) => (
                <li key={p.platform} className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PLATFORM_COLORS[p.platform] }}
                    />
                    {PLATFORM_LABELS[p.platform]}
                  </span>
                  <span className="font-semibold text-ink">{(p.share * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {doneCount < checklist.length && (
          <div className="rounded-2xl bg-contrast p-5 text-contrast-ink shadow-card lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">Primeiros passos</p>
              <span className="text-sm text-accent">{doneCount}/{checklist.length}</span>
            </div>
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                        item.done ? 'bg-accent text-accent-ink' : 'bg-contrast-ink/10 text-contrast-ink/40'
                      }`}
                    >
                      {item.done ? '✓' : ''}
                    </span>
                    <span className={item.done ? 'text-contrast-ink/60 line-through' : 'text-contrast-ink'}>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={`rounded-2xl border border-line bg-card p-5 shadow-card ${doneCount === checklist.length ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <Lightbulb className="h-4 w-4 text-accent" /> Sugestões para a próxima publicação
            </p>
            <Link href="/dashboard/insights" className="text-xs font-semibold text-accent hover:underline">
              Ver todas
            </Link>
          </div>
          {suggestions && suggestions.length > 0 ? (
            <ul className="space-y-3">
              {suggestions.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{s.headline}</p>
                    <p className="text-xs text-muted">{s.bestTimeToPost}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                    score {s.viralScore.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhuma sugestão disponível ainda. Conecte suas redes para começar.</p>
          )}
        </div>
      </section>

      <NewsCarousel />

      <SavedForLaterCarousel />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink">Atalhos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ href, label, description, icon: Icon }) => {
            const badge = shortcutBadges[href]
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-card-elev"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" />
                  </span>
                  {badge && (
                    <span className="rounded-full bg-card-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                      {badge}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-ink">{label}</p>
                  <p className="text-xs text-muted">{description}</p>
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
      ? 'bg-contrast text-contrast-ink'
      : tone === 'gold'
        ? 'bg-accent text-accent-ink'
        : 'border border-line text-ink'
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
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-lg font-bold text-ink">{value.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}

function EngagementGauge({ segments }: { segments: Array<{ share: number; color: string }> }) {
  const active = segments.filter((s) => s.share > 0)
  const gapDeg = active.length > 1 ? 6 : 0
  let acc = 0
  const stops: string[] = []
  for (const s of active) {
    const start = acc * 360
    acc += s.share
    const end = acc * 360
    if (gapDeg > 0 && stops.length > 0) stops.push(`var(--ss-card) ${start}deg ${start + gapDeg}deg`)
    stops.push(`${s.color} ${start + gapDeg}deg ${end}deg`)
  }
  const background = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'var(--ss-card-2)'
  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background }}>
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-card" />
    </div>
  )
}
