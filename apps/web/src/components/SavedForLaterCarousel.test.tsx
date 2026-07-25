import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import { SavedForLaterCarousel } from './SavedForLaterCarousel'
import { api, type ApiPerformanceSuggestion, type ApiPost } from '../lib/api'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('../lib/api', () => ({
  api: {
    getShelvedPerformanceSuggestions: vi.fn(),
    getSavedForLaterPosts: vi.fn(),
    getImageUrl: vi.fn(),
    publishPost: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderCarousel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SavedForLaterCarousel />
    </QueryClientProvider>,
  )
}

function makeSuggestion(overrides: Partial<ApiPerformanceSuggestion> = {}): ApiPerformanceSuggestion {
  return {
    id: 's1',
    brandId: 'brand-1',
    headline: 'Sugestão guardada',
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

describe('SavedForLaterCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([])
    mockedApi.getSavedForLaterPosts.mockResolvedValue([])
  })

  it('mostra o estado vazio quando não há nada guardado', async () => {
    renderCarousel()

    expect(await screen.findByText(/Nada guardado ainda/)).toBeInTheDocument()
  })

  it('mostra um rascunho guardado com a ação de aprovar e publicar', async () => {
    mockedApi.getSavedForLaterPosts.mockResolvedValue([makePost()])

    renderCarousel()

    expect(await screen.findByText('Rascunho guardado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aprovar e publicar' })).toBeInTheDocument()
  })

  it('publica o rascunho guardado ao clicar em aprovar e publicar', async () => {
    mockedApi.getSavedForLaterPosts.mockResolvedValue([makePost()])
    mockedApi.publishPost.mockResolvedValue({ postId: 'post-1', results: [], failedPlatforms: [] })

    renderCarousel()
    await screen.findByText('Rascunho guardado')

    screen.getByRole('button', { name: 'Aprovar e publicar' }).click()

    await waitFor(() => expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1'))
  })

  it('mostra uma sugestão guardada com a ação de criar post', async () => {
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([makeSuggestion()])

    renderCarousel()

    expect(await screen.findByText('Sugestão guardada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar post disso' })).toBeInTheDocument()
  })

  it('navega para o compose com a sugestão como seed ao clicar em criar post', async () => {
    mockedApi.getShelvedPerformanceSuggestions.mockResolvedValue([makeSuggestion({ headline: 'Ideia legal' })])

    renderCarousel()
    await screen.findByText('Ideia legal')

    screen.getByRole('button', { name: 'Criar post disso' }).click()

    expect(pushMock).toHaveBeenCalledWith('/dashboard/generate?seed=Ideia%20legal')
  })

  it('link "Ver todos" aponta para o hub de guardados', async () => {
    renderCarousel()

    const link = await screen.findByText('Ver todos')
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/saved-for-later')
  })
})
