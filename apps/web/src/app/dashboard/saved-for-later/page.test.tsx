import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import SavedForLaterPage from './page'
import { api, type ApiPerformanceSuggestion, type ApiPost } from '../../../lib/api'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getShelvedPerformanceSuggestions: vi.fn(),
    setPerformanceSuggestionShelved: vi.fn(),
    getSavedForLaterPosts: vi.fn(),
    setPostSavedForLater: vi.fn(),
    publishPost: vi.fn(),
    deletePost: vi.fn(),
    getImageUrl: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SavedForLaterPage />
    </QueryClientProvider>,
  )
}

function makeSuggestion(overrides: Partial<ApiPerformanceSuggestion> = {}): ApiPerformanceSuggestion {
  return {
    id: 's1',
    brandId: 'brand-1',
    headline: 'Ideia guardada',
    rationale: 'rationale',
    viralScore: 5,
    basedOnThemes: [],
    feedback: null,
    bestTimeToPost: '',
    bestTimeWeekdays: [],
    bestTimeHourStart: 0,
    bestTimeHourEnd: 23,
    shelved: true,
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
    content: [{ platform: Platform.INSTAGRAM, text: 'Rascunho guardado' }],
    imageStoragePaths: [],
    videoStoragePath: null,
    status: 'ai-draft',
    origin: 'autonomy-tick',
    externalIds: {},
    scheduledAt: null,
    publishedAt: null,
    imagesDeletedAt: null,
    savedForLater: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('SavedForLaterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([])
    mockedApi.getSavedForLaterPosts.mockResolvedValue([])
  })

  it('mostra o estado vazio quando não há nada guardado', async () => {
    renderPage()

    expect(await screen.findByText(/Nada guardado ainda/)).toBeInTheDocument()
  })

  it('mostra sugestões guardadas de Insights', async () => {
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([makeSuggestion()])

    renderPage()

    expect(await screen.findByText('Ideia guardada')).toBeInTheDocument()
    expect(screen.getByText('💡 Sugestão de Insights')).toBeInTheDocument()
  })

  it('mostra rascunhos guardados de Agendados', async () => {
    mockedApi.getSavedForLaterPosts.mockResolvedValue([makePost()])

    renderPage()

    expect(await screen.findByText('Rascunho guardado')).toBeInTheDocument()
    expect(screen.getByText('🤖 Rascunho de Agendados')).toBeInTheDocument()
  })

  it('remove uma sugestão da prateleira', async () => {
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([makeSuggestion()])
    mockedApi.setPerformanceSuggestionShelved.mockResolvedValue(undefined)

    renderPage()
    await screen.findByText('Ideia guardada')

    screen.getByRole('button', { name: 'Remover da prateleira' }).click()

    await waitFor(() => expect(mockedApi.setPerformanceSuggestionShelved).toHaveBeenCalledWith('s1', false))
  })

  it('aprova e publica um rascunho guardado', async () => {
    mockedApi.getSavedForLaterPosts.mockResolvedValue([makePost()])
    mockedApi.publishPost.mockResolvedValue({ postId: 'post-1', results: [], failedPlatforms: [] })

    renderPage()
    await screen.findByText('Rascunho guardado')

    screen.getByRole('button', { name: 'Aprovar e publicar agora' }).click()

    await waitFor(() => expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1'))
  })

  it('remove um rascunho dos guardados', async () => {
    mockedApi.getSavedForLaterPosts.mockResolvedValue([makePost()])
    mockedApi.setPostSavedForLater.mockResolvedValue(makePost({ savedForLater: false }))

    renderPage()
    await screen.findByText('Rascunho guardado')

    screen.getByRole('button', { name: 'Remover dos guardados' }).click()

    await waitFor(() => expect(mockedApi.setPostSavedForLater).toHaveBeenCalledWith('post-1', false))
  })
})
