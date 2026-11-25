import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminSignupsPage from './page'
import { api, type ApiAdminSignupsSummary } from '../../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../../lib/api', () => ({
  api: {
    getAdminSignups: vi.fn(),
    markSignupHandled: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AdminSignupsPage />
    </QueryClientProvider>,
  )
}

function makeSummary(overrides: Partial<ApiAdminSignupsSummary> = {}): ApiAdminSignupsSummary {
  return {
    signups: [
      { userId: 'user-1', email: 'novo@exemplo.com', signedUpAt: '2026-11-24T10:00:00Z', metaTesterHandled: false },
    ],
    ...overrides,
  }
}

describe('AdminSignupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista um cadastro pendente com o e-mail e a data', async () => {
    mockedApi.getAdminSignups.mockResolvedValue(makeSummary())

    renderPage()

    expect(await screen.findByText('novo@exemplo.com')).toBeInTheDocument()
    expect(screen.getByText('Pendentes (1)')).toBeInTheDocument()
  })

  it('separa cadastros já liberados dos pendentes', async () => {
    mockedApi.getAdminSignups.mockResolvedValue(
      makeSummary({
        signups: [
          { userId: 'user-1', email: 'pendente@exemplo.com', signedUpAt: '2026-11-24T10:00:00Z', metaTesterHandled: false },
          { userId: 'user-2', email: 'liberado@exemplo.com', signedUpAt: '2026-11-20T10:00:00Z', metaTesterHandled: true },
        ],
      }),
    )

    renderPage()

    expect(await screen.findByText('Pendentes (1)')).toBeInTheDocument()
    expect(screen.getByText('Já liberados (1)')).toBeInTheDocument()
    expect(screen.getByText('pendente@exemplo.com')).toBeInTheDocument()
    expect(screen.getByText('liberado@exemplo.com')).toBeInTheDocument()
  })

  it('marca um cadastro como liberado ao clicar no checkbox', async () => {
    mockedApi.getAdminSignups.mockResolvedValue(makeSummary())
    mockedApi.markSignupHandled.mockResolvedValue(undefined)

    renderPage()

    const checkbox = await screen.findByRole('checkbox')
    fireEvent.click(checkbox)

    await waitFor(() => expect(mockedApi.markSignupHandled).toHaveBeenCalledWith('user-1', true))
  })

  it('linka direto pro painel de apps da Meta', async () => {
    mockedApi.getAdminSignups.mockResolvedValue(makeSummary())

    renderPage()

    expect(await screen.findByRole('link', { name: /Abrir Meta for Developers/ })).toHaveAttribute(
      'href',
      'https://developers.facebook.com/apps/',
    )
  })

  it('mostra estado vazio quando não há nenhum cadastro', async () => {
    mockedApi.getAdminSignups.mockResolvedValue({ signups: [] })

    renderPage()

    expect(await screen.findByText('Nenhum cadastro encontrado.')).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando a chamada falha (ex.: 403 de quem não é admin)', async () => {
    mockedApi.getAdminSignups.mockRejectedValue(new Error('Forbidden'))

    renderPage()

    expect(await screen.findByText(/Não foi possível carregar os cadastros/)).toBeInTheDocument()
  })
})
