import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import ScheduledPostsPage from './page'
import { api, type ApiPost } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getPosts: vi.fn(),
    getImageUrl: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makePost(overrides: Partial<ApiPost> = {}): ApiPost {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'user-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Texto agendado para o LinkedIn' }],
    imageStoragePaths: [],
    status: 'scheduled',
    externalIds: {},
    scheduledAt: new Date('2026-07-01T12:00:00.000Z').toISOString(),
    publishedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ScheduledPostsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ScheduledPostsPage', () => {
  it('mostra os posts agendados com data, plataforma e prévia do texto', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])

    renderPage()

    expect(await screen.findByText('Texto agendado para o LinkedIn')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
    expect(mockedApi.getPosts).toHaveBeenCalledWith('scheduled')
  })

  it('mostra mensagem quando não há posts agendados', async () => {
    mockedApi.getPosts.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText(/Nenhum post agendado ainda/)).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando a chamada falha', async () => {
    mockedApi.getPosts.mockRejectedValue(new Error('Falha de rede'))

    renderPage()

    expect(await screen.findByText(/Não foi possível carregar os posts agendados/)).toBeInTheDocument()
  })
})
