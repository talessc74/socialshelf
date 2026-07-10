import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import type { ProfileDiagnostic } from '@socialshelf/domain'
import PerformanceDashboardPage from './page'
import { api, type ApiPostPerformanceEntry, type ApiPostsPerformanceResult } from '../../../lib/api'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getPostsPerformance: vi.fn(),
    getPerformanceInsights: vi.fn(),
    getLatestPerformanceInsights: vi.fn().mockResolvedValue(null),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeEntry(overrides: Partial<ApiPostPerformanceEntry> = {}): ApiPostPerformanceEntry {
  return {
    postId: 'post-1',
    platform: Platform.LINKEDIN,
    text: 'Texto do post de melhor desempenho',
    metrics: { impressions: 1000, likes: 50, comments: 10, shares: 5 },
    score: 1065,
    publishedAt: new Date('2026-06-01T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function makeResult(overrides: Partial<ApiPostsPerformanceResult> = {}): ApiPostsPerformanceResult {
  return {
    entries: [],
    errors: [],
    ...overrides,
  }
}

function makeDiagnostic(overrides: Partial<ProfileDiagnostic> = {}): ProfileDiagnostic {
  return {
    niche: 'Tecnologia Jurídica',
    diagnosisSummary: 'Seu perfil tem um bom engajamento inicial.',
    viralPotential: 45,
    whatWorks: [{ title: 'Proposta de valor clara', description: 'Os posts comunicam bem o serviço.' }],
    engagingThemes: [{ label: 'Introdução do produto', strength: 80 }],
    topFormats: ['CAROUSEL_ALBUM'],
    bestTimes: ['08:00'],
    engagementAnalysis: 'Mais curtidas do que comentários.',
    actionPlan: [{ title: 'Crie CTAs para comentários', description: 'Peça opiniões ao final do post.' }],
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PerformanceDashboardPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PerformanceDashboardPage', () => {
  it('mostra os KPIs agregados e o ranking de posts da sessão da rede', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))

    renderPage()

    expect(await screen.findByText('Texto do post de melhor desempenho')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LinkedIn' })).toBeInTheDocument()
  })

  it('avisa que o painel de cada rede só se completa depois que ela publica com sucesso', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))

    renderPage()

    expect(
      await screen.findByText(/só aparecem depois que ela publica com sucesso/),
    ).toBeInTheDocument()
  })

  it('mostra mensagem quando não há posts com métricas medidas', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult())

    renderPage()

    expect(await screen.findByText(/Nenhum post publicado com métricas medidas/)).toBeInTheDocument()
  })

  it('isola o erro de uma rede sem afetar a exibição das demais', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(
      makeResult({
        entries: [makeEntry({ platform: Platform.LINKEDIN })],
        errors: [{ platform: Platform.INSTAGRAM, postId: 'post-2', message: 'Token do Instagram expirado' }],
      }),
    )
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('Texto do post de melhor desempenho')).toBeInTheDocument()
    const instagramTab = screen.getByRole('button', { name: /Instagram/ })
    expect(instagramTab).toBeInTheDocument()

    await user.click(instagramTab)

    expect(await screen.findByText(/Token do Instagram expirado/)).toBeInTheDocument()
    expect(screen.queryByText('Texto do post de melhor desempenho')).not.toBeInTheDocument()
  })

  it('mostra aviso de seguidores mínimos (não "reconectar") quando o erro de permissão é do Facebook', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(
      makeResult({
        entries: [makeEntry({ platform: Platform.LINKEDIN })],
        errors: [
          {
            platform: Platform.FACEBOOK,
            postId: 'post-2',
            message:
              'Facebook metrics fetch failed: 400 {"error":{"message":"(#10) This endpoint requires the \'pages_read_engagement\' permission or the \'Page Public Content Access\' feature.","type":"OAuthException","code":10,"fbtrace_id":"AcGnZX7PqK_isiwwGjzJYAY"}}',
          },
        ],
      }),
    )
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('Texto do post de melhor desempenho')).toBeInTheDocument()
    const facebookTab = screen.getByRole('button', { name: /Facebook/ })

    await user.click(facebookTab)

    expect(await screen.findByText(/100 seguidores/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Reconectar conta/ })).not.toBeInTheDocument()
    const technicalDetails = screen.getByText(/OAuthException/).closest('details')
    expect(technicalDetails).not.toBeNull()
    expect(technicalDetails).not.toHaveAttribute('open')
  })

  it('mostra mensagem amigável e link para reconectar quando o erro de permissão é de outra rede', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(
      makeResult({
        entries: [makeEntry({ platform: Platform.LINKEDIN })],
        errors: [
          {
            platform: Platform.INSTAGRAM,
            postId: 'post-2',
            message:
              'Instagram metrics fetch failed: 400 {"error":{"message":"(#10) OAuthException","type":"OAuthException","code":10,"fbtrace_id":"AcGnZX7PqK_isiwwGjzJYAY"}}',
          },
        ],
      }),
    )
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('Texto do post de melhor desempenho')).toBeInTheDocument()
    const instagramTab = screen.getByRole('button', { name: /Instagram/ })

    await user.click(instagramTab)

    expect(
      await screen.findByText(/perdeu uma permissão necessária para ler as métricas/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reconectar conta/ })).toHaveAttribute(
      'href',
      '/dashboard/accounts',
    )
    const technicalDetails = screen.getByText(/OAuthException/).closest('details')
    expect(technicalDetails).not.toBeNull()
    expect(technicalDetails).not.toHaveAttribute('open')
  })

  it('gera o diagnóstico automaticamente ao entrar na tela, sem precisar clicar', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))
    mockedApi.getPerformanceInsights.mockResolvedValue(makeDiagnostic())

    renderPage()

    expect(await screen.findByText('Tecnologia Jurídica')).toBeInTheDocument()
    expect(screen.getByText('Crie CTAs para comentários')).toBeInTheDocument()
    expect(mockedApi.getPerformanceInsights).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '↻ Refazer análise' })).toBeInTheDocument()
  })

  it('permite refazer a análise manualmente após a análise automática terminar', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))
    mockedApi.getPerformanceInsights
      .mockResolvedValueOnce(makeDiagnostic())
      .mockResolvedValueOnce(makeDiagnostic({ niche: 'Novo Nicho' }))
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText('Tecnologia Jurídica')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '↻ Refazer análise' }))

    expect(await screen.findByText('Novo Nicho')).toBeInTheDocument()
    expect(mockedApi.getPerformanceInsights).toHaveBeenCalledTimes(2)
  })

  it('traduz o erro "No published posts with metrics to analyze" em vez de mostrar em inglês', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))
    mockedApi.getPerformanceInsights.mockRejectedValue(new Error('No published posts with metrics to analyze'))

    renderPage()

    expect(
      await screen.findByText('Ainda não há posts publicados com métricas medidas para gerar o diagnóstico.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/No published posts/)).not.toBeInTheDocument()
  })

  it('refaz a análise sozinha quando a quantidade de posts com métrica muda, mesmo após uma falha anterior', async () => {
    mockedApi.getPostsPerformance.mockResolvedValueOnce(makeResult({ entries: [makeEntry()] }))
    mockedApi.getPerformanceInsights
      .mockRejectedValueOnce(new Error('No published posts with metrics to analyze'))
      .mockResolvedValueOnce(makeDiagnostic({ niche: 'Novo Nicho' }))

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <PerformanceDashboardPage />
      </QueryClientProvider>,
    )

    expect(
      await screen.findByText('Ainda não há posts publicados com métricas medidas para gerar o diagnóstico.'),
    ).toBeInTheDocument()

    mockedApi.getPostsPerformance.mockResolvedValue(
      makeResult({ entries: [makeEntry(), makeEntry({ platform: Platform.FACEBOOK })] }),
    )
    await queryClient.invalidateQueries({ queryKey: ['posts-performance'] })
    rerender(
      <QueryClientProvider client={queryClient}>
        <PerformanceDashboardPage />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Novo Nicho')).toBeInTheDocument()
    expect(mockedApi.getPerformanceInsights).toHaveBeenCalledTimes(2)
  })

  it('usa o Instagram como rede padrão quando o Facebook só tem erro de seguidores', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(
      makeResult({
        entries: [makeEntry({ platform: Platform.INSTAGRAM })],
        errors: [
          {
            platform: Platform.FACEBOOK,
            postId: 'post-2',
            message:
              'Facebook metrics fetch failed: 400 {"error":{"message":"(#10) This endpoint requires the \'pages_read_engagement\' permission or the \'Page Public Content Access\' feature.","type":"OAuthException","code":10}}',
          },
        ],
      }),
    )

    renderPage()

    expect(await screen.findByText('Texto do post de melhor desempenho')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Instagram/ })).toHaveClass('bg-accent')
    expect(screen.queryByText(/100 seguidores/)).not.toBeInTheDocument()
  })

  it('mostra a última análise salva com data/hora enquanto a análise automática roda', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))
    mockedApi.getLatestPerformanceInsights.mockResolvedValue({
      id: 'diag-1',
      brandId: 'brand-1',
      postsAnalyzed: 3,
      diagnostic: makeDiagnostic({ niche: 'Diagnóstico Salvo' }),
      computedAt: '2026-06-20T14:30:00.000Z',
    })
    // Nunca resolve: simula a análise fresca ainda em andamento.
    mockedApi.getPerformanceInsights.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(await screen.findByText('Diagnóstico Salvo')).toBeInTheDocument()
    expect(screen.getByText(/Última análise:/)).toBeInTheDocument()
  })

  it('navega para a geração com o texto do post ao clicar em "Semear Criação"', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue(makeResult({ entries: [makeEntry()] }))
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Semear Criação/ }))

    expect(pushMock).toHaveBeenCalledWith(
      '/dashboard/generate?seed=' + encodeURIComponent('Texto do post de melhor desempenho'),
    )
  })
})
