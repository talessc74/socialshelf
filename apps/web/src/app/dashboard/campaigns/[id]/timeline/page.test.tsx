import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
    order: null,
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

  it('reorders photos within a post using the move-forward arrow', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2')])
    mockedApi.getCampaignTimeline.mockResolvedValue([makeItem('item-1', ['photo-1', 'photo-2'])])
    mockedApi.getImageUrls.mockImplementation(async (paths) =>
      Object.fromEntries(paths.map((path) => [path, `https://example.com/${path}`])),
    )
    mockedApi.updateCampaignTimeline.mockResolvedValue([])

    renderPage()

    const moveForwardButtons = await screen.findAllByRole('button', {
      name: 'Mover foto para frente (pode passar pro próximo post)',
    })
    fireEvent.click(moveForwardButtons[0]!)

    fireEvent.click(await screen.findByText('Salvar alterações'))

    await waitFor(() =>
      expect(mockedApi.updateCampaignTimeline).toHaveBeenCalledWith(
        'campaign-1',
        expect.arrayContaining([expect.objectContaining({ id: 'item-1', photoIds: ['photo-2', 'photo-1'] })]),
      ),
    )
  })

  it('spills a photo into the next post when moved past the edge of a single-photo post', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2')])
    mockedApi.getCampaignTimeline.mockResolvedValue([
      makeItem('item-1', ['photo-1']),
      makeItem('item-2', ['photo-2']),
    ])
    mockedApi.getImageUrls.mockImplementation(async (paths) =>
      Object.fromEntries(paths.map((path) => [path, `https://example.com/${path}`])),
    )
    mockedApi.updateCampaignTimeline.mockResolvedValue([])

    renderPage()

    const moveForwardButtons = await screen.findAllByRole('button', {
      name: 'Mover foto para frente (pode passar pro próximo post)',
    })
    fireEvent.click(moveForwardButtons[0]!)

    fireEvent.click(await screen.findByText('Salvar alterações'))

    await waitFor(() =>
      expect(mockedApi.updateCampaignTimeline).toHaveBeenCalledWith('campaign-1', [
        expect.objectContaining({ id: 'item-2', photoIds: ['photo-1', 'photo-2'] }),
      ]),
    )
  })

  it('removing a photo leaves the post with a single photo instead of a carousel', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2')])
    mockedApi.getCampaignTimeline.mockResolvedValue([makeItem('item-1', ['photo-1', 'photo-2'])])
    mockedApi.getImageUrls.mockImplementation(async (paths) =>
      Object.fromEntries(paths.map((path) => [path, `https://example.com/${path}`])),
    )

    renderPage()

    expect(await screen.findByText('Carrossel · 2 fotos')).toBeInTheDocument()
    const removeButtons = await screen.findAllByRole('button', { name: 'Remover foto deste post' })
    fireEvent.click(removeButtons[0]!)

    expect(await screen.findByText('1 foto')).toBeInTheDocument()
  })
})
