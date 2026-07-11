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
    deleteCampaignPhoto: vi.fn(),
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

  it('shows an error instead of silently rendering an empty list when fetching uploaded photos fails', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockRejectedValue(new Error('9 FAILED_PRECONDITION: The query requires an index.'))

    renderPage()

    expect(
      await screen.findByText(/Não foi possível carregar as fotos já enviadas/),
    ).toBeInTheDocument()
  })

  it('shows a thumbnail grid for photos that have already been uploaded', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2')])
    mockedApi.getImageUrl.mockImplementation(async (path) => `https://example.com/${path}`)

    const { container } = renderPage()

    expect(await screen.findByText(/2 fotos enviadas/)).toBeInTheDocument()
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
  })

  it('deletes a photo when its remove button is clicked and confirmed', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos
      .mockResolvedValueOnce([makePhoto('photo-1'), makePhoto('photo-2')])
      .mockResolvedValue([makePhoto('photo-2')])
    mockedApi.getImageUrl.mockImplementation(async (path) => `https://example.com/${path}`)
    mockedApi.deleteCampaignPhoto.mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()

    expect(await screen.findByText(/2 fotos enviadas/)).toBeInTheDocument()
    const removeButtons = await screen.findAllByRole('button', { name: 'Remover foto' })
    fireEvent.click(removeButtons[0]!)

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(mockedApi.deleteCampaignPhoto).toHaveBeenCalledWith('campaign-1', 'photo-1'))
    expect(await screen.findByText(/1 foto enviada/)).toBeInTheDocument()
  })

  it('does not delete a photo when the confirmation is declined', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1')])
    mockedApi.getImageUrl.mockImplementation(async (path) => `https://example.com/${path}`)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderPage()

    const removeButton = await screen.findByRole('button', { name: 'Remover foto' })
    fireEvent.click(removeButton)

    expect(window.confirm).toHaveBeenCalled()
    expect(mockedApi.deleteCampaignPhoto).not.toHaveBeenCalled()
  })

  it('shows how many photos of the batch have been uploaded so far, not just a static "sending" message', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([])
    let resolveFirstUpload!: (photo: ApiCampaignPhoto) => void
    const firstUpload = new Promise<ApiCampaignPhoto>((resolve) => {
      resolveFirstUpload = resolve
    })
    mockedApi.uploadCampaignPhoto
      .mockImplementationOnce(() => firstUpload)
      .mockResolvedValueOnce(makePhoto('photo-2'))

    renderPage()

    const dropzone = await screen.findByText(/Clique ou arraste as fotos aqui/)
    const fileA = new File(['a'], 'a.jpg', { type: 'image/jpeg' })
    const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropzone, { dataTransfer: { files: [fileA, fileB] } })

    expect(await screen.findByText('Enviando fotos… (0/2)')).toBeInTheDocument()

    resolveFirstUpload(makePhoto('photo-1'))
    expect(await screen.findByText('Enviando fotos… (1/2)')).toBeInTheDocument()

    await waitFor(() => expect(mockedApi.uploadCampaignPhoto).toHaveBeenCalledTimes(2))
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
