import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CampaignsPage from './page'
import { api, type ApiPhotoCampaign } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({
  api: {
    listCampaigns: vi.fn(),
    cancelCampaign: vi.fn(),
    pauseCampaign: vi.fn(),
    resumeCampaign: vi.fn(),
    discardCampaign: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeCampaign(overrides: Partial<ApiPhotoCampaign> = {}): ApiPhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'user-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem',
    keywords: [],
    platforms: [],
    postsPerDay: 2,
    carouselSizeDefault: 5,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    photosDeletedAt: null,
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CampaignsPage />
    </QueryClientProvider>,
  )
}

describe('CampaignsPage', () => {
  it('shows an empty state when there are no campaigns', async () => {
    mockedApi.listCampaigns.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/Nenhuma campanha ainda/)).toBeInTheDocument()
  })

  it('lists campaigns with their status badge', async () => {
    mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'reviewing' })])
    renderPage()
    expect(await screen.findByText('Viagem à Europa')).toBeInTheDocument()
    expect(screen.getByText('Em revisão')).toBeInTheDocument()
  })

  it('points an empty draft campaign to the upload step', async () => {
    mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft' })])
    renderPage()
    const link = await screen.findByText('Subir fotos')
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/campaigns/campaign-1/upload')
  })

  it('shows "Continuar upload" instead of "Subir fotos" for a draft that already has photos', async () => {
    mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft', photoCount: 148 })])
    renderPage()
    expect(await screen.findByText('Continuar upload')).toBeInTheDocument()
    expect(screen.queryByText('Subir fotos')).not.toBeInTheDocument()
    expect(screen.getByText('148 fotos enviadas')).toBeInTheDocument()
  })

  it('points a reviewing campaign to the timeline step', async () => {
    mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'reviewing' })])
    renderPage()
    const link = await screen.findByText('Revisar linha do tempo')
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/campaigns/campaign-1/timeline')
  })

  it('offers "Adicionar fotos" for a reviewing or an active campaign, pointing to upload', async () => {
    mockedApi.listCampaigns.mockResolvedValue([
      makeCampaign({ id: 'c-reviewing', status: 'reviewing' }),
      makeCampaign({ id: 'c-active', status: 'active' }),
    ])
    renderPage()
    const links = await screen.findAllByText('Adicionar fotos')
    expect(links).toHaveLength(2)
    expect(links[0]!.closest('a')).toHaveAttribute('href', '/dashboard/campaigns/c-reviewing/upload')
    expect(links[1]!.closest('a')).toHaveAttribute('href', '/dashboard/campaigns/c-active/upload')
  })

  it('does not offer "Adicionar fotos" for draft, completed or cancelled campaigns', async () => {
    mockedApi.listCampaigns.mockResolvedValue([
      makeCampaign({ id: 'c-draft', status: 'draft' }),
      makeCampaign({ id: 'c-completed', status: 'completed' }),
      makeCampaign({ id: 'c-cancelled', status: 'cancelled' }),
    ])
    renderPage()
    await screen.findAllByText('Viagem à Europa')
    expect(screen.queryByText('Adicionar fotos')).not.toBeInTheDocument()
  })

  describe('cancel campaign', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('shows a cancel button for a draft campaign', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft' })])
      renderPage()
      expect(await screen.findByRole('button', { name: 'Cancelar campanha' })).toBeInTheDocument()
    })

    it('shows a cancel button for a reviewing campaign', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'reviewing' })])
      renderPage()
      expect(await screen.findByRole('button', { name: 'Cancelar campanha' })).toBeInTheDocument()
    })

    it('shows a cancel button for active and paused campaigns too', async () => {
      mockedApi.listCampaigns.mockResolvedValue([
        makeCampaign({ id: 'c-active', status: 'active' }),
        makeCampaign({ id: 'c-paused', status: 'paused' }),
      ])
      renderPage()
      expect(await screen.findAllByRole('button', { name: 'Cancelar campanha' })).toHaveLength(2)
    })

    it('does not show a cancel button for completed or cancelled campaigns', async () => {
      mockedApi.listCampaigns.mockResolvedValue([
        makeCampaign({ id: 'c-completed', status: 'completed' }),
        makeCampaign({ id: 'c-cancelled', status: 'cancelled' }),
      ])
      renderPage()
      await screen.findAllByText('Viagem à Europa')
      expect(screen.queryByRole('button', { name: 'Cancelar campanha' })).not.toBeInTheDocument()
    })

    it('asks for confirmation and cancels the campaign when confirmed', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft' })])
      mockedApi.cancelCampaign.mockResolvedValue(makeCampaign({ status: 'cancelled' }))
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Cancelar campanha' }))

      expect(window.confirm).toHaveBeenCalledWith(
        'Tem certeza que deseja cancelar a campanha "Viagem à Europa"? As fotos ainda não usadas em nenhum post serão apagadas do armazenamento em 7 dias. Essa ação não pode ser desfeita.',
      )
      await waitFor(() => expect(mockedApi.cancelCampaign).toHaveBeenCalledWith('campaign-1'))
    })

    it('does not cancel the campaign when the user backs out of the confirmation', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft' })])
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Cancelar campanha' }))

      expect(mockedApi.cancelCampaign).not.toHaveBeenCalled()
    })

    it('shows an error message when cancelling fails', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft' })])
      mockedApi.cancelCampaign.mockRejectedValue(new Error('Only a campaign that has not started can be cancelled'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Cancelar campanha' }))

      expect(
        await screen.findByText('Não foi possível cancelar: Only a campaign that has not started can be cancelled'),
      ).toBeInTheDocument()
    })
  })

  describe('discard campaign', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('shows a discard button only for a cancelled campaign', async () => {
      mockedApi.listCampaigns.mockResolvedValue([
        makeCampaign({ id: 'c-cancelled', status: 'cancelled' }),
        makeCampaign({ id: 'c-draft', status: 'draft' }),
        makeCampaign({ id: 'c-completed', status: 'completed' }),
      ])
      renderPage()
      expect(await screen.findAllByText('Viagem à Europa')).toHaveLength(3)
      expect(screen.getAllByRole('button', { name: 'Descartar' })).toHaveLength(1)
    })

    it('asks for confirmation, warning what happens, and discards the campaign when confirmed', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'cancelled' })])
      mockedApi.discardCampaign.mockResolvedValue(undefined)
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Descartar' }))

      expect(window.confirm).toHaveBeenCalledWith(
        'Tem certeza que deseja descartar a campanha "Viagem à Europa"? As fotos ainda não usadas em nenhum post serão apagadas do armazenamento agora mesmo, não em 7 dias. A campanha some por completo dos nossos servidores e você não terá mais acesso a ela. Essa ação não pode ser desfeita.',
      )
      await waitFor(() => expect(mockedApi.discardCampaign).toHaveBeenCalledWith('campaign-1'))
    })

    it('does not discard the campaign when the user backs out of the confirmation', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'cancelled' })])
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Descartar' }))

      expect(mockedApi.discardCampaign).not.toHaveBeenCalled()
    })

    it('shows an error message when discarding fails', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'cancelled' })])
      mockedApi.discardCampaign.mockRejectedValue(new Error('Only cancelled campaigns can be discarded'))
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Descartar' }))

      expect(
        await screen.findByText('Não foi possível descartar: Only cancelled campaigns can be discarded'),
      ).toBeInTheDocument()
    })
  })

  describe('pause and resume campaign', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('shows a pause button only for an active campaign', async () => {
      mockedApi.listCampaigns.mockResolvedValue([
        makeCampaign({ id: 'c-active', status: 'active' }),
        makeCampaign({ id: 'c-draft', status: 'draft' }),
      ])
      renderPage()
      expect(await screen.findAllByText('Viagem à Europa')).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: 'Pausar campanha' })).toHaveLength(1)
    })

    it('pauses the campaign on click', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'active' })])
      mockedApi.pauseCampaign.mockResolvedValue(makeCampaign({ status: 'paused' }))

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Pausar campanha' }))

      await waitFor(() => expect(mockedApi.pauseCampaign).toHaveBeenCalledWith('campaign-1'))
    })

    it('shows a resume button only for a paused campaign', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'paused' })])
      renderPage()
      expect(await screen.findByRole('button', { name: 'Retomar campanha' })).toBeInTheDocument()
    })

    it('resumes the campaign on click', async () => {
      mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'paused' })])
      mockedApi.resumeCampaign.mockResolvedValue(makeCampaign({ status: 'active' }))

      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Retomar campanha' }))

      await waitFor(() => expect(mockedApi.resumeCampaign).toHaveBeenCalledWith('campaign-1'))
    })
  })
})
