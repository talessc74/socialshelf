import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CampaignsPage from './page'
import { api, type ApiPhotoCampaign } from '../../../lib/api'

vi.mock('../../../lib/api', () => ({
  api: {
    listCampaigns: vi.fn(),
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

  it('points a draft campaign to the upload step', async () => {
    mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'draft' })])
    renderPage()
    const link = await screen.findByText('Subir fotos')
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/campaigns/campaign-1/upload')
  })

  it('points a reviewing campaign to the timeline step', async () => {
    mockedApi.listCampaigns.mockResolvedValue([makeCampaign({ status: 'reviewing' })])
    renderPage()
    const link = await screen.findByText('Revisar linha do tempo')
    expect(link.closest('a')).toHaveAttribute('href', '/dashboard/campaigns/campaign-1/timeline')
  })
})
