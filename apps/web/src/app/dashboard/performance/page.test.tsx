import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import type { ProfileDiagnostic } from '@socialshelf/domain'
import PerformanceDashboardPage from './page'
import { api, type ApiPostPerformanceEntry } from '../../../lib/api'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getPostsPerformance: vi.fn(),
    getPerformanceInsights: vi.fn(),
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
  it('mostra os KPIs agregados e o ranking de posts', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue([makeEntry()])

    renderPage()

    expect(await screen.findByText('Texto do post de melhor desempenho')).toBeInTheDocument()
    expect(screen.getByText('Ranking de posts')).toBeInTheDocument()
  })

  it('mostra mensagem quando não há posts com métricas medidas', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText(/Nenhum post publicado com métricas medidas/)).toBeInTheDocument()
  })

  it('mostra o diagnóstico ao clicar em "Gerar Diagnóstico"', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue([makeEntry()])
    mockedApi.getPerformanceInsights.mockResolvedValue(makeDiagnostic())
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: '✨ Gerar Diagnóstico' }))

    expect(await screen.findByText('Tecnologia Jurídica')).toBeInTheDocument()
    expect(screen.getByText('Crie CTAs para comentários')).toBeInTheDocument()
  })

  it('navega para a geração com o texto do post ao clicar em "Semear Criação"', async () => {
    mockedApi.getPostsPerformance.mockResolvedValue([makeEntry()])
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByRole('button', { name: /Semear Criação/ }))

    expect(pushMock).toHaveBeenCalledWith(
      '/dashboard/generate?seed=' + encodeURIComponent('Texto do post de melhor desempenho'),
    )
  })
})
