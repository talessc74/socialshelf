import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import DashboardPage from './page'
import { api, type ApiPerformanceSuggestion, type ApiPost } from '../../lib/api'

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
    status: 'scheduled',
    externalIds: {},
    scheduledAt: new Date('2026-07-01T12:00:00.000Z').toISOString(),
    publishedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
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
    mockedApi.getConnections.mockResolvedValue([
      { id: 'c1', userId: 'u', brandId: 'u', platform: Platform.LINKEDIN, pairwiseId: 'p', tokenRef: 't', scopes: [], expiresAt: null, createdAt: '', updatedAt: '' },
      { id: 'c2', userId: 'u', brandId: 'u', platform: Platform.INSTAGRAM, pairwiseId: 'p', tokenRef: 't', scopes: [], expiresAt: null, createdAt: '', updatedAt: '' },
    ])

    renderPage()

    expect(await screen.findByText('2/4 conectadas')).toBeInTheDocument()
  })

  it('mostra badge "Pendente" no atalho de marca quando não há perfil configurado', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(null)

    renderPage()

    const badge = await screen.findByText('Pendente')
    expect(badge.closest('a')).toHaveAttribute('href', '/dashboard/brand')
  })

  it('mostra badge "Configurada" no atalho de marca quando há perfil configurado', async () => {
    mockedApi.getBrandProfile.mockResolvedValue({
      id: 'brand-1',
      userId: 'user-1',
      brandId: 'user-1',
      version: 1,
      business: { name: 'Minha Marca', segment: 'Tecnologia', description: '' },
      identity: { positioning: '', values: [] },
      visual: { primaryColor: '#000', secondaryColor: '#fff', typography: '', logoStoragePath: null },
      voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
      narrative: { recurringThemes: [] },
      operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
      createdAt: new Date().toISOString(),
    })

    renderPage()

    expect(await screen.findByText('Configurada')).toBeInTheDocument()
  })
})
