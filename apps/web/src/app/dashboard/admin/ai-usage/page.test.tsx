import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminAiUsagePage from './page'
import { api, type ApiAdminAiUsageSummary } from '../../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../../lib/api', () => ({
  api: {
    getAdminAiUsageSummary: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdminAiUsagePage />
    </QueryClientProvider>,
  )
}

function makeSummary(overrides: Partial<ApiAdminAiUsageSummary> = {}): ApiAdminAiUsageSummary {
  return {
    brands: [
      {
        brandId: 'brand-1',
        brandName: 'Eai Jurídico',
        months: [{ month: '2026-07', textUsd: 0.01, imageUsd: 0.4, totalUsd: 0.41 }],
      },
    ],
    ...overrides,
  }
}

describe('AdminAiUsagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra o nome da marca e o total em R$ convertido do custo estimado em USD', async () => {
    mockedApi.getAdminAiUsageSummary.mockResolvedValue(makeSummary())

    renderPage()

    expect(await screen.findByText('Eai Jurídico')).toBeInTheDocument()
    expect(screen.getByText('2026-07')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há nenhuma marca', async () => {
    mockedApi.getAdminAiUsageSummary.mockResolvedValue({ brands: [] })

    renderPage()

    expect(await screen.findByText('Nenhuma conta encontrada.')).toBeInTheDocument()
  })

  it('mostra que a marca ainda não tem uso registrado quando months está vazio', async () => {
    mockedApi.getAdminAiUsageSummary.mockResolvedValue(
      makeSummary({ brands: [{ brandId: 'brand-2', brandName: 'Conta pessoal', months: [] }] }),
    )

    renderPage()

    expect(await screen.findByText('Conta pessoal')).toBeInTheDocument()
    expect(screen.getByText('Nenhum uso de IA registrado ainda.')).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando a chamada falha (ex.: 403 de quem não é admin)', async () => {
    mockedApi.getAdminAiUsageSummary.mockRejectedValue(new Error('Forbidden'))

    renderPage()

    expect(await screen.findByText(/Não foi possível carregar os gastos/)).toBeInTheDocument()
  })
})
