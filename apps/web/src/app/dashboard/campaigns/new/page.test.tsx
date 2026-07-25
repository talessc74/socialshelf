import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import NewCampaignPage from './page'
import { api, type ApiConnection } from '../../../../lib/api'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('../../../../lib/api', () => ({
  api: {
    getConnections: vi.fn(),
    createCampaign: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeConnection(platform: Platform): ApiConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'user-1',
    platform,
    pairwiseId: 'pairwise-1',
    tokenRef: 'token-ref',
    scopes: [],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <NewCampaignPage />
    </QueryClientProvider>,
  )
}

describe('NewCampaignPage', () => {
  it('does not offer X (Twitter) as a campaign platform even when connected', async () => {
    mockedApi.getConnections.mockResolvedValue([
      makeConnection(Platform.INSTAGRAM),
      makeConnection(Platform.TWITTER),
    ])
    renderPage()

    expect(await screen.findByText(/Instagram/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /X \(Twitter\)/ })).not.toBeInTheDocument()
  })

  it('creates the campaign and redirects to the upload step', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.INSTAGRAM)])
    mockedApi.createCampaign.mockResolvedValue({
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
      photosDeletedAt: null,
    })

    renderPage()

    fireEvent.change(screen.getByLabelText('Nome da campanha'), { target: { value: 'Viagem à Europa' } })
    fireEvent.click(await screen.findByText(/Instagram/))
    fireEvent.click(screen.getByText('Criar campanha e subir fotos'))

    await waitFor(() => expect(mockedApi.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Viagem à Europa', platforms: [Platform.INSTAGRAM] }),
    ))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard/campaigns/campaign-1/upload'))
  })

  it('keeps the submit button disabled until a name and a platform are chosen', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.INSTAGRAM)])
    renderPage()

    expect(screen.getByText('Criar campanha e subir fotos')).toBeDisabled()
  })

  it('allows clearing and retyping "posts por dia" without snapping to 1 or 10', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.INSTAGRAM)])
    renderPage()

    const input = await screen.findByLabelText('Posts por dia')
    expect(input).toHaveValue(2)

    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue(null)
    fireEvent.change(input, { target: { value: '5' } })
    expect(input).toHaveValue(5)

    fireEvent.change(input, { target: { value: '99' } })
    expect(input).toHaveValue(99)
    fireEvent.blur(input)
    expect(input).toHaveValue(10)
  })
})
