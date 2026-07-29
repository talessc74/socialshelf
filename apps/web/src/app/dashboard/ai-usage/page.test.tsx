import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AiUsagePage from './page'
import { api, type ApiAiUsageSummary } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getAiUsageSummary: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AiUsagePage />
    </QueryClientProvider>,
  )
}

describe('AiUsagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o resumo mensal e o total em R$ convertido do custo estimado em USD', async () => {
    const summary: ApiAiUsageSummary = { months: [{ month: '2026-07', textUsd: 0.01, imageUsd: 0.4, totalUsd: 0.41 }] }
    mockedApi.getAiUsageSummary.mockResolvedValue(summary)

    renderPage()

    expect(await screen.findByText('2026-07')).toBeInTheDocument()
    expect(screen.getByText('Resumo mensal')).toBeInTheDocument()
  })

  it('mostra estado vazio quando a marca não tem uso registrado', async () => {
    mockedApi.getAiUsageSummary.mockResolvedValue({ months: [] })

    renderPage()

    expect(await screen.findByText('Nenhum uso de IA registrado ainda.')).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando a chamada falha', async () => {
    mockedApi.getAiUsageSummary.mockRejectedValue(new Error('Internal error'))

    renderPage()

    expect(await screen.findByText('Não foi possível carregar os gastos desta marca.')).toBeInTheDocument()
  })
})
