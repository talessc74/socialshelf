import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import CampaignTimelinePage from './page'
import { api, type ApiPhotoCampaign, type ApiCampaignPhoto, type ApiCampaignItem } from '../../../../../lib/api'

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
    getImageUrls: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makePhoto(id: string): ApiCampaignPhoto {
  return {
    id,
    campaignId: 'campaign-1',
    storagePath: `${id}.jpg`,
    exifTakenAt: null,
    gpsLat: null,
    gpsLng: null,
    locationClusterId: null,
    createdAt: new Date().toISOString(),
  }
}

function makeItem(id: string, photoIds: string[]): ApiCampaignItem {
  return {
    id,
    campaignId: 'campaign-1',
    order: 0,
    photoIds,
    caption: 'Legenda',
    scheduledAt: new Date().toISOString(),
    status: 'planned',
    postId: null,
  }
}

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

  it('resolves all item thumbnails in a single batched request instead of one per photo', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2')])
    mockedApi.getCampaignTimeline.mockResolvedValue([makeItem('item-1', ['photo-1', 'photo-2'])])
    mockedApi.getImageUrls.mockImplementation(async (paths) =>
      Object.fromEntries(paths.map((path) => [path, `https://example.com/${path}`])),
    )

    const { container } = renderPage()

    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
    expect(mockedApi.getImageUrls).toHaveBeenCalledTimes(1)
    expect(mockedApi.getImageUrls).toHaveBeenCalledWith(['photo-1.jpg', 'photo-2.jpg'])
  })
})
