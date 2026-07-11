import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import DashboardPage from './page'
import {
  api,
  type ApiBrandProfile,
  type ApiConnection,
  type ApiPerformanceSuggestion,
  type ApiPost,
  type ApiPostPerformanceEntry,
  type ApiTopicSuggestion,
} from '../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, logout: vi.fn() }),
}))

vi.mock('../../lib/api', () => ({
  api: {
    getBrandProfile: vi.fn(),
    getConnections: vi.fn(),
    getPostsPerformance: vi.fn(),
    getPerformanceSuggestions: vi.fn(),
    getPosts: vi.fn(),
    getTopicSuggestions: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeSuggestion(overrides: Partial<ApiPerformanceSuggestion> = {}): ApiPerformanceSuggestion {
  return {
    id: 'suggestion-1',
    brandId: 'user-1',
    headline: 'Sugestão de post',
    rationale: 'rationale',
    viralScore: 8.2,
    basedOnThemes: [],
    feedback: null,
    bestTimeToPost: 'terça às 10h',
    bestTimeWeekdays: [2],
    bestTimeHourStart: 10,
    bestTimeHourEnd: 11,
    shelved: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makePost(overrides: Partial<ApiPost> = {}): ApiPost {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'user-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Post agendado' }],
    imageStoragePaths: [],
    videoStoragePath: null,
    status: 'scheduled',
    origin: 'manual',
    externalIds: {},
    scheduledAt: new Date('2026-07-01T12:00:00.000Z').toISOString(),
    publishedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function makeConnection(platform: Platform, overrides: Partial<ApiConnection> = {}): ApiConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'user-1',
    platform,
    pairwiseId: 'pairwise-1',
    tokenRef: 'token-ref',
    scopes: [],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeBrandProfile(overrides: Partial<ApiBrandProfile> = {}): ApiBrandProfile {
  return {
    id: 'brand-1',
    userId: 'user-1',
    brandId: 'user-1',
    version: 1,
    business: { name: 'Minha Marca', segment: 'Tecnologia', description: '' },
    identity: { positioning: '', values: [] },
    visual: { primaryColor: '#000', secondaryColor: '#fff', typography: '', logoStoragePath: null },
    voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
    narrative: { recurringThemes: [] },
    operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1 },
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeTopicSuggestion(overrides: Partial<ApiTopicSuggestion> = {}): ApiTopicSuggestion {
  return {
    id: 'topic-1',
    brandId: 'user-1',
    headline: 'Notícia relevante para o nicho',
    summary: 'Resumo da notícia.',
    sourceUrl: 'https://example.com/noticia',
    sourceDomain: 'example.com',
    articleUrl: 'https://news.google.com/rss/articles/abc',
    rationale: 'rationale',
    audienceFitScore: 1.8,
    thumbnailUrl: null,
    publishedPlatforms: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeEntry(overrides: Partial<ApiPostPerformanceEntry> = {}): ApiPostPerformanceEntry {
  return {
    postId: 'post-1',
    platform: Platform.LINKEDIN,
    text: 'Post publicado',
    metrics: { impressions: 0, likes: 10, comments: 2, shares: 1 },
    score: 13,
    publishedAt: new Date('2026-06-23T12:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getBrandProfile.mockResolvedValue(null)
  mockedApi.getConnections.mockResolvedValue([])
  mockedApi.getPostsPerformance.mockResolvedValue({ entries: [], errors: [] })
  mockedApi.getPerformanceSuggestions.mockResolvedValue([])
  mockedApi.getPosts.mockResolvedValue([])
  mockedApi.getTopicSuggestions.mockResolvedValue([])
})

describe('DashboardPage - badges dos Atalhos', () => {
  it('não mostra badge de posts agendados enquanto a contagem ainda não chegou', () => {
    mockedApi.getPosts.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.queryByText(/^\d+ agendados?$/)).not.toBeInTheDocument()
  })

  it('mostra "0 agendados" quando não há nenhum post agendado', async () => {
    mockedApi.getPosts.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('0 agendados')).toBeInTheDocument()
  })

  it('mostra "1 agendado" no singular quando há exatamente um post agendado', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])

    renderPage()

    expect(await screen.findByText('1 agendado')).toBeInTheDocument()
  })

  it('mostra "3 agendados" no plural quando há vários posts agendados', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost({ id: 'post-1' }), makePost({ id: 'post-2' }), makePost({ id: 'post-3' })])

    renderPage()

    expect(await screen.findByText('3 agendados')).toBeInTheDocument()
  })

  it('coloca o badge de agendados dentro do card "Posts Agendados", não em outro atalho', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])

    renderPage()

    const badge = await screen.findByText('1 agendado')
    expect(badge.closest('a')).toHaveAttribute('href', '/dashboard/scheduled')
  })

  it('não mostra badge de sugestões quando todas estão arquivadas (shelved)', async () => {
    mockedApi.getPerformanceSuggestions.mockResolvedValue([
      makeSuggestion({ id: 's1', headline: 'Sugestão arquivada 1', shelved: true }),
      makeSuggestion({ id: 's2', headline: 'Sugestão arquivada 2', shelved: true }),
    ])

    renderPage()

    await screen.findByText('Sugestão arquivada 1')
    expect(screen.queryByText(/^\d+ novas?$/)).not.toBeInTheDocument()
  })

  it('mostra "1 nova" no singular quando há uma sugestão não arquivada', async () => {
    mockedApi.getPerformanceSuggestions.mockResolvedValue([makeSuggestion({ shelved: false })])

    renderPage()

    expect(await screen.findByText('1 nova')).toBeInTheDocument()
  })

  it('mostra "2 novas" no plural quando há múltiplas sugestões não arquivadas', async () => {
    mockedApi.getPerformanceSuggestions.mockResolvedValue([
      makeSuggestion({ id: 's1', headline: 'Sugestão 1', shelved: false }),
      makeSuggestion({ id: 's2', headline: 'Sugestão 2', shelved: false }),
    ])

    renderPage()

    expect(await screen.findByText('2 novas')).toBeInTheDocument()
  })

  it('mostra "0/4 conectadas" no atalho de contas quando não há nenhuma conexão', async () => {
    mockedApi.getConnections.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('0/4 conectadas')).toBeInTheDocument()
  })

  it('mostra a contagem de redes conectadas no atalho de Central de Contas', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN), makeConnection(Platform.INSTAGRAM)])

    renderPage()

    expect(await screen.findByText('2/4 conectadas')).toBeInTheDocument()
  })

  it('conta plataformas únicas, ignorando conexões duplicadas da mesma rede', async () => {
    mockedApi.getConnections.mockResolvedValue([
      makeConnection(Platform.LINKEDIN),
      makeConnection(Platform.INSTAGRAM),
      makeConnection(Platform.FACEBOOK),
      makeConnection(Platform.TWITTER, { id: 'conn-twitter-legacy' }),
      makeConnection(Platform.TWITTER, { id: 'conn-twitter-oauth' }),
    ])

    renderPage()

    expect(await screen.findByText('4/4 conectadas')).toBeInTheDocument()
  })

  it('mostra badge "Pendente" no atalho de marca quando não há perfil configurado', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(null)

    renderPage()

    const badge = await screen.findByText('Pendente')
    expect(badge.closest('a')).toHaveAttribute('href', '/dashboard/brand')
  })

  it('mostra badge "Configurada" no atalho de marca quando há perfil configurado', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())

    renderPage()

    expect(await screen.findByText('Configurada')).toBeInTheDocument()
  })
})

describe('DashboardPage - badge de como a conta está sendo tratada', () => {
  it('não mostra nenhum badge de autonomia enquanto não há perfil de marca configurado', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(null)

    renderPage()

    await screen.findByText('Primeiros passos')
    expect(screen.queryByText(/Manual|Semi-automático|Automático/)).not.toBeInTheDocument()
  })

  it('mostra "Manual" quando a marca está no modo manual', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile({ operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1 } }))

    renderPage()

    const badge = await screen.findByText(/Manual/)
    expect(badge.closest('a')).toHaveAttribute('href', '/dashboard/brand')
  })

  it('mostra "Semi-automático" quando a marca está nesse modo', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(
      makeBrandProfile({ operation: { autonomyLevel: 'semi-automatic', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1 } }),
    )

    renderPage()

    expect(await screen.findByText(/Semi-automático/)).toBeInTheDocument()
    expect(await screen.findByText('IA prepara, você aprova antes')).toBeInTheDocument()
  })

  it('mostra "Automático" quando a marca está nesse modo', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(
      makeBrandProfile({ operation: { autonomyLevel: 'automatic', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 3 } }),
    )

    renderPage()

    expect(await screen.findByText(/Automático/)).toBeInTheDocument()
    expect(await screen.findByText('IA cria e publica sozinha')).toBeInTheDocument()
  })
})

describe('DashboardPage - gráfico de Impressões na semana', () => {
  it('mostra aviso de indisponibilidade em vez de gráfico vazio quando há posts medidos mas nenhuma rede reportou impressões', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue({
      entries: [makeEntry({ metrics: { impressions: 0, likes: 10, comments: 2, shares: 1 } })],
      errors: [],
    })

    renderPage()

    expect(await screen.findByText(/Nenhuma rede conectada reportou impressões/)).toBeInTheDocument()
  })

  it('mostra as barras do gráfico normalmente quando há impressões reportadas', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue({
      entries: [makeEntry({ metrics: { impressions: 500, likes: 10, comments: 2, shares: 1 } })],
      errors: [],
    })

    renderPage()

    await screen.findByText('Impressões na semana')
    expect(screen.queryByText(/Nenhuma rede conectada reportou impressões/)).not.toBeInTheDocument()
  })

  it('não mostra aviso de indisponibilidade quando ainda não há nenhum post medido', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue({ entries: [], errors: [] })

    renderPage()

    await screen.findByText('Impressões na semana')
    expect(screen.queryByText(/Nenhuma rede conectada reportou impressões/)).not.toBeInTheDocument()
  })
})

describe('DashboardPage - card "Primeiros passos"', () => {
  it('mostra o checklist enquanto a primeira etapa ainda não foi concluída', async () => {
    renderPage()

    expect(await screen.findByText('Primeiros passos')).toBeInTheDocument()
  })

  it('esconde o card "Primeiros passos" quando todas as etapas já foram concluídas', async () => {
    mockedApi.getConnections.mockResolvedValue([
      makeConnection(Platform.LINKEDIN),
      makeConnection(Platform.INSTAGRAM),
      makeConnection(Platform.FACEBOOK),
      makeConnection(Platform.TWITTER),
    ])
    mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())
    mockedApi.getPostsPerformance.mockResolvedValue({ entries: [makeEntry()], errors: [] })

    renderPage()

    await screen.findByText('4/4 conectadas')
    expect(screen.queryByText('Primeiros passos')).not.toBeInTheDocument()
  })
})

describe('DashboardPage - carrossel de notícias para pauta', () => {
  it('mostra estado vazio quando não há notícia sugerida', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Notícias para pauta')).toBeInTheDocument()
    expect(await screen.findByText(/Nenhuma notícia disponível ainda/)).toBeInTheDocument()
  })

  it('mostra manchete, domínio da fonte e score de aderência de cada notícia sugerida', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([
      makeTopicSuggestion({ headline: 'IA muda o mercado de pequenos negócios', sourceDomain: 'g1.globo.com', audienceFitScore: 2.4 }),
    ])

    renderPage()

    expect(await screen.findByText('IA muda o mercado de pequenos negócios')).toBeInTheDocument()
    expect(screen.getByText('g1.globo.com')).toBeInTheDocument()
    expect(screen.getByText('2.4')).toBeInTheDocument()
  })

  it('mostra múltiplas notícias lado a lado, uma por card', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([
      makeTopicSuggestion({ id: 'topic-1', headline: 'Notícia 1' }),
      makeTopicSuggestion({ id: 'topic-2', headline: 'Notícia 2' }),
    ])

    renderPage()

    expect(await screen.findByText('Notícia 1')).toBeInTheDocument()
    expect(screen.getByText('Notícia 2')).toBeInTheDocument()
  })

  it('mostra o thumbnail da notícia quando há imagem de capa', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([
      makeTopicSuggestion({ headline: 'Com capa', thumbnailUrl: 'https://cdn.exemplo.com/capa.jpg' }),
    ])

    renderPage()

    const img = (await screen.findByAltText(/Imagem da notícia/)) as HTMLImageElement
    expect(img).toHaveAttribute('src', 'https://cdn.exemplo.com/capa.jpg')
  })

  it('o botão "Criar post disso" leva para o gerador com a manchete pré-preenchida', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([makeTopicSuggestion({ headline: 'Manchete de teste' })])

    renderPage()

    const cta = await screen.findByRole('link', { name: 'Criar post disso' })
    expect(cta).toHaveAttribute('href', '/dashboard/generate?seed=Manchete%20de%20teste')
  })
})
