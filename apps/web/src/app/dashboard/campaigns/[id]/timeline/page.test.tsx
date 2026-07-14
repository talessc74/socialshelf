import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import CampaignTimelinePage from './page'
import { api, type ApiPhotoCampaign, type ApiCampaignPhoto, type ApiCampaignItem } from '../../../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../../../contexts/AssistantContext'

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'campaign-1' }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('../../../../../lib/api', () => ({
  api: {
    getCampaign: vi.fn(),
    getCampaignPhotos: vi.fn(),
    getCampaignTimeline: vi.fn(),
    updateCampaignTimeline: vi.fn(),
    activateCampaign: vi.fn(),
    cancelCampaign: vi.fn(),
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
      <AssistantProvider>
        <CampaignTimelinePage />
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>
        <SelfieNarrationProbe />
        <CampaignTimelinePage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

describe('CampaignTimelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('narra ao Selfie o total de fotos e posts da linha do tempo', async () => {
    mockedApi.getCampaign.mockResolvedValue(makeCampaign())
    mockedApi.getCampaignPhotos.mockResolvedValue([makePhoto('photo-1'), makePhoto('photo-2'), makePhoto('photo-3')])
    mockedApi.getCampaignTimeline.mockResolvedValue([
      makeItem('item-1', ['photo-1', 'photo-2']),
      makeItem('item-2', ['photo-3']),
    ])
    mockedApi.getImageUrls.mockImplementation(async (paths) =>
      Object.fromEntries(paths.map((path) => [path, `https://example.com/${path}`])),
    )

    renderPageWithNarrationProbe()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('3 fotos')
    })
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('2 posts')
  })

  describe('cancelar campanha', () => {
    it('mostra o botão de cancelar campanha enquanto a campanha está em revisão', async () => {
      mockedApi.getCampaign.mockResolvedValue(makeCampaign({ status: 'reviewing' }))
      mockedApi.getCampaignPhotos.mockResolvedValue([])
      mockedApi.getCampaignTimeline.mockResolvedValue([])

      renderPage()

      expect(await screen.findByRole('button', { name: 'Cancelar campanha' })).toBeInTheDocument()
    })

    it('não mostra o botão de cancelar quando a campanha já está ativa', async () => {
      mockedApi.getCampaign.mockResolvedValue(makeCampaign({ status: 'active' }))
      mockedApi.getCampaignPhotos.mockResolvedValue([])
      mockedApi.getCampaignTimeline.mockResolvedValue([makeItem('item-1', ['photo-1'])])
      mockedApi.getImageUrls.mockResolvedValue({})

      renderPage()

      await screen.findByText('1 foto')
      expect(screen.queryByRole('button', { name: 'Cancelar campanha' })).not.toBeInTheDocument()
    })

    it('pede confirmação, cancela a campanha e volta para a lista', async () => {
      mockedApi.getCampaign.mockResolvedValue(makeCampaign({ status: 'reviewing' }))
      mockedApi.getCampaignPhotos.mockResolvedValue([])
      mockedApi.getCampaignTimeline.mockResolvedValue([])
      mockedApi.cancelCampaign.mockResolvedValue(makeCampaign({ status: 'cancelled' }))
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Cancelar campanha' }))

      expect(window.confirm).toHaveBeenCalledWith(
        'Tem certeza que deseja cancelar a campanha "Viagem à Europa"? Essa ação não pode ser desfeita.',
      )
      await waitFor(() => expect(mockedApi.cancelCampaign).toHaveBeenCalledWith('campaign-1'))
      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/campaigns'))
    })

    it('não cancela quando o usuário desiste na confirmação', async () => {
      mockedApi.getCampaign.mockResolvedValue(makeCampaign({ status: 'reviewing' }))
      mockedApi.getCampaignPhotos.mockResolvedValue([])
      mockedApi.getCampaignTimeline.mockResolvedValue([])
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Cancelar campanha' }))

      expect(mockedApi.cancelCampaign).not.toHaveBeenCalled()
    })
  })
})
