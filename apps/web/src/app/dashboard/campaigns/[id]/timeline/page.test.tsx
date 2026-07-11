import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import CampaignTimelinePage from './page'
import { api, type ApiPhotoCampaign } from '../../../../../lib/api'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'campaign-1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../../../../lib/api', () => ({
  api: {
    getCampaign: vi.fn(),
    getCampaignPhotos: vi.fn(),
    getCampaignTimeline: vi.fn(),
    updateCampaignTimeline: vi.fn(),
    activateCampaign: vi.fn(),
    getImageUrl: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeCampaign(overrides: Partial<ApiPhotoCampaign> = {}): ApiPhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'user-1',
    name: 'Viagem à Europa',
    description: '',
    keywords: [],
    platforms: [Platform.INSTAGRAM],
    postsPerDay: 2,
    carouselSizeDefault: 5,
    status: 'reviewing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CampaignTimelinePage />
    </QueryClientProvider>,
  )
}

describe('CampaignTimelinePage', () => {
  it('shows an error instead of silently rendering an empty timeline when fetching items fails', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([])
    mockedApi.getCampaignTimeline.mockRejectedValue(
      new Error('9 FAILED_PRECONDITION: The query requires an index.'),
    )

    renderPage()

    expect(await screen.findByText(/Não foi possível carregar a linha do tempo/)).toBeInTheDocument()
  })
})
