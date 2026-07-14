import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NewsPage from './page'
import { api, type ApiTopicSuggestion } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

vi.mock('../../../lib/api', () => ({
  api: {
    getTopicSuggestions: vi.fn(),
    searchNews: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeSuggestion(overrides: Partial<ApiTopicSuggestion> = {}): ApiTopicSuggestion {
  return {
    id: 's1',
    brandId: 'brand-1',
    headline: 'Manchete de teste',
    summary: 'Resumo',
    sourceUrl: 'https://example.com/a',
    sourceDomain: 'example.com',
    articleUrl: 'https://example.com/a',
    rationale: 'Conecta com o tema de LegalTech da marca',
    audienceFitScore: 5,
    thumbnailUrl: null,
    publishedPlatforms: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

/** Sonda que expõe o texto narrado ao Selfie, para asserção nos testes. */
function SelfieNarrationProbe() {
  const { narration } = useSelfie()
  return <div data-testid="selfie-narration">{narration.active ? narration.message : ''}</div>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>
        <SelfieNarrationProbe />
        <NewsPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NewsPage', () => {
  it('narra o rationale da sugestão de maior aderência quando as notícias carregam', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([
      makeSuggestion({ id: 'low', audienceFitScore: 1, rationale: 'pouco relevante' }),
      makeSuggestion({ id: 'high', audienceFitScore: 9, headline: 'A melhor notícia', rationale: 'muito relevante' }),
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('A melhor notícia')
    })
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('muito relevante')
  })

  it('não narra nada enquanto não há sugestões', async () => {
    mockedApi.getTopicSuggestions.mockResolvedValue([])

    renderPage()

    await screen.findByText('Nenhuma notícia disponível ainda. A IA verifica fontes confiáveis e avisa aqui quando encontrar algo relevante para sua marca.')
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('')
  })
})
