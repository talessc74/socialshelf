import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InsightsBankPage from './page'
import { api } from '../../../lib/api'

let searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => searchParams,
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getShelvedPerformanceSuggestions: vi.fn(),
    getPerformanceSuggestions: vi.fn(),
    getTopicSuggestions: vi.fn(),
    searchNews: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderPage() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <InsightsBankPage />
    </QueryClientProvider>,
  )
}

describe('InsightsBankPage', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams()
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([])
    mockedApi.getPerformanceSuggestions.mockResolvedValue([])
    mockedApi.getTopicSuggestions.mockResolvedValue([])
  })

  it('abre na aba "Guardadas" por padrão', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Guardadas' })).toHaveClass('border-brand-600')
    expect(screen.queryByText('Buscar uma notícia')).not.toBeInTheDocument()
  })

  it('abre direto na aba "Notícias" quando a URL traz ?tab=news', () => {
    searchParams = new URLSearchParams('tab=news')
    renderPage()

    expect(screen.getByRole('button', { name: 'Notícias' })).toHaveClass('border-brand-600')
    expect(screen.getByText('Buscar uma notícia')).toBeInTheDocument()
  })
})
