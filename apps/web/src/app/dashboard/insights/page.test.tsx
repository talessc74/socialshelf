import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InsightsBankPage from './page'
import { api, type ApiPerformanceSuggestion } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

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
      <AssistantProvider>
        <InsightsBankPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

/** Sonda que expõe o texto narrado ao Selfie, para asserção nos testes. */
function SelfieNarrationProbe() {
  const { narration } = useSelfie()
  return <div data-testid="selfie-narration">{narration.active ? narration.message : ''}</div>
}

function renderPageWithNarrationProbe() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>
        <SelfieNarrationProbe />
        <InsightsBankPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

function makeSuggestion(overrides: Partial<ApiPerformanceSuggestion> = {}): ApiPerformanceSuggestion {
  return {
    id: 's1',
    brandId: 'brand-1',
    headline: 'Ideia padrão',
    rationale: 'rationale',
    viralScore: 5,
    basedOnThemes: [],
    feedback: null,
    bestTimeToPost: '',
    bestTimeWeekdays: [],
    bestTimeHourStart: 0,
    bestTimeHourEnd: 23,
    shelved: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
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

    expect(screen.getByRole('button', { name: 'Guardadas' })).toHaveClass('border-accent')
    expect(screen.queryByText('Buscar uma notícia')).not.toBeInTheDocument()
  })

  it('abre direto na aba "Notícias" quando a URL traz ?tab=news', () => {
    searchParams = new URLSearchParams('tab=news')
    renderPage()

    expect(screen.getByRole('button', { name: 'Notícias' })).toHaveClass('border-accent')
    expect(screen.getByText('Buscar uma notícia')).toBeInTheDocument()
  })
})

describe('InsightsBankPage — narração do Selfie', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams()
    mockedApi.getTopicSuggestions.mockResolvedValue([])
  })

  it('destaca a ideia de maior potencial viral entre frescas e guardadas', async () => {
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([
      makeSuggestion({ id: 'g1', headline: 'Guardada forte', viralScore: 9 }),
    ])
    mockedApi.getPerformanceSuggestions.mockResolvedValue([
      makeSuggestion({ id: 'f1', headline: 'Fresca fraca', viralScore: 3 }),
    ])

    renderPageWithNarrationProbe()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('Guardada forte')
    })
  })

  it('não narra nada sem sugestões em nenhuma aba', async () => {
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([])
    mockedApi.getPerformanceSuggestions.mockResolvedValue([])

    renderPageWithNarrationProbe()

    await screen.findByText(/Nenhuma ideia guardada ainda/)
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('')
  })
})
