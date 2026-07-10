import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import CampaignUploadPage from './page'
import { api, type ApiPhotoCampaign, type ApiCampaignPhoto } from '../../../../../lib/api'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'campaign-1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../../../../lib/api', () => ({
  api: {
    getCampaign: vi.fn(),
    getCampaignPhotos: vi.fn(),
    uploadCampaignPhoto: vi.fn(),
    generateCampaignTimeline: vi.fn(),
    getImageUrl: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeCampaign(): ApiPhotoCampaign {
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
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  }
}

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CampaignUploadPage />
    </QueryClientProvider>,
  )
}

describe('CampaignUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a thumbnail grid for photos that have already been uploaded', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2')])
    mockedApi.getImageUrl.mockImplementation(async (path) => `https://example.com/${path}`)

    const { container } = renderPage()

    expect(await screen.findByText(/2 fotos enviadas/)).toBeInTheDocument()
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
  })

  it('uploads a file dropped onto the dropzone', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([])
    mockedApi.uploadCampaignPhoto.mockResolvedValue(makePhoto('photo-1'))

    renderPage()

    const dropzone = await screen.findByText(/Clique ou arraste as fotos aqui/)
    const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' })

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(mockedApi.uploadCampaignPhoto).toHaveBeenCalledWith('campaign-1', file))
  })

  it('shows a "solte as fotos aqui" hint while dragging over the dropzone', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([])

    renderPage()

    const dropzone = await screen.findByText(/Clique ou arraste as fotos aqui/)
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [] } })

    expect(await screen.findByText('Solte as fotos aqui')).toBeInTheDocument()
  })

  it('still uploads a file chosen via the hidden file input (click-to-select)', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([])
    mockedApi.uploadCampaignPhoto.mockResolvedValue(makePhoto('photo-1'))

    renderPage()

    const file = new File(['fake-image'], 'photo.jpg', { type: 'image/jpeg' })
    const input = document.getElementById('campaign-photos-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(mockedApi.uploadCampaignPhoto).toHaveBeenCalledWith('campaign-1', file))
  })

  it('keeps uploading the rest of the batch and still refreshes the list when one photo fails', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValueOnce([]).mockResolvedValue([makePhoto('photo-ok')])
    mockedApi.uploadCampaignPhoto.mockImplementation(async (_campaignId, file: File) => {
      if (file.name === 'bad.jpg') throw new Error('arquivo corrompido')
      return makePhoto('photo-ok')
    })

    renderPage()

    const good = new File(['a'], 'good.jpg', { type: 'image/jpeg' })
    const bad = new File(['b'], 'bad.jpg', { type: 'image/jpeg' })
    const dropzone = await screen.findByText(/Clique ou arraste as fotos aqui/)

    fireEvent.drop(dropzone, { dataTransfer: { files: [bad, good] } })

    // Both files were attempted even though the first one failed.
    await waitFor(() => expect(mockedApi.uploadCampaignPhoto).toHaveBeenCalledTimes(2))
    // The list still refreshes despite the partial failure — the successful photo shows up.
    expect(await screen.findByText(/1 foto enviada/)).toBeInTheDocument()
    expect(await screen.findByText(/1 de 2 foto\(s\) não subiram/)).toBeInTheDocument()
  })
})
