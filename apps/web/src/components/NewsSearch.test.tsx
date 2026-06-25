import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NewsSearch } from './NewsSearch'
import { api, type ApiTopicSuggestion } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    searchNews: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeTopicSuggestion(overrides: Partial<ApiTopicSuggestion> = {}): ApiTopicSuggestion {
  return {
    id: 'topic-1',
    brandId: 'user-1',
    headline: 'Notícia relevante para a busca',
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

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NewsSearch />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NewsSearch', () => {
  it('keeps the search button disabled until something is typed', () => {
    renderComponent()

    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
  })

  it('searches and renders matching news when the user submits a query', async () => {
    mockedApi.searchNews.mockResolvedValue([makeTopicSuggestion({ headline: 'IA muda o varejo' })])
    const user = userEvent.setup()

    renderComponent()

    await user.type(screen.getByPlaceholderText(/Ex\.:/), 'inteligência artificial no varejo')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(mockedApi.searchNews).toHaveBeenCalledWith('inteligência artificial no varejo')
    expect(await screen.findByText('IA muda o varejo')).toBeInTheDocument()
  })

  it('shows an empty state when no verified news matches the query', async () => {
    mockedApi.searchNews.mockResolvedValue([])
    const user = userEvent.setup()

    renderComponent()

    await user.type(screen.getByPlaceholderText(/Ex\.:/), 'assunto bem específico')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText(/Nenhuma notícia verificada encontrada/)).toBeInTheDocument()
  })

  it('shows an error message when the search fails', async () => {
    mockedApi.searchNews.mockRejectedValue(new Error('network error'))
    const user = userEvent.setup()

    renderComponent()

    await user.type(screen.getByPlaceholderText(/Ex\.:/), 'inteligência artificial')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText(/Não foi possível buscar agora/)).toBeInTheDocument()
  })

  it('lets the user create a post directly from a search result', async () => {
    mockedApi.searchNews.mockResolvedValue([makeTopicSuggestion({ headline: 'Manchete de teste' })])
    const user = userEvent.setup()

    renderComponent()

    await user.type(screen.getByPlaceholderText(/Ex\.:/), 'inteligência artificial')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    const cta = await screen.findByRole('link', { name: 'Criar post disso' })
    expect(cta).toHaveAttribute('href', '/dashboard/generate?seed=Manchete%20de%20teste')
  })
})
