import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import AccountsPage from './page'
import { api, type ApiConnection } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

let mockSearchParams = new URLSearchParams()
const mockReplace = vi.fn()
const mockRouter = { replace: mockReplace }

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getConnections: vi.fn(),
    getAuthorizeUrl: vi.fn(),
    getLinkedInPageAuthorizeUrl: vi.fn(),
    getLinkedInPagePendingSelection: vi.fn(),
    selectLinkedInPage: vi.fn(),
    getMetaPagePendingSelection: vi.fn(),
    selectMetaPage: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeConnection(platform: Platform): ApiConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: 'pairwise-1',
    tokenRef: 'token-ref',
    scopes: [],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/** Sonda que expõe o texto narrado ao Selfie, para asserção nos testes. */
function SelfieNarrationProbe() {
  const { narration } = useSelfie()
  return <div data-testid="selfie-narration">{narration.active ? narration.message : ''}</div>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>
        <SelfieNarrationProbe />
        <AccountsPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchParams = new URLSearchParams()
})

describe('AccountsPage — narração do Selfie', () => {
  it('narra quantas redes estão conectadas quando as conexões carregam', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN), makeConnection(Platform.INSTAGRAM)])

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('2 de 5')
    })
  })

  it('narra aviso de nenhuma rede conectada', async () => {
    mockedApi.getConnections.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('não conectou nenhuma')
    })
  })
})

describe('AccountsPage — accountLabel e seleção de Página do Meta', () => {
  it('exibe o nome da Página/handle conectada junto ao badge de status', async () => {
    mockedApi.getConnections.mockResolvedValue([
      { ...makeConnection(Platform.FACEBOOK), accountLabel: 'Rádio Kactus' },
    ])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Rádio Kactus')).toBeInTheDocument()
    })
  })

  it('carrega e exibe as Páginas pendentes quando metaPagePending está na URL, e conclui a seleção ao clicar', async () => {
    mockSearchParams = new URLSearchParams({ metaPagePending: 'pending-1' })
    mockedApi.getConnections.mockResolvedValue([])
    mockedApi.getMetaPagePendingSelection.mockResolvedValue([
      { id: 'page-1', name: 'Página Pessoal' },
      {
        id: 'page-2',
        name: 'EAI Jurídico',
        instagram_business_account: { id: 'ig-1', username: 'eai.juridico' },
      },
    ])
    mockedApi.selectMetaPage.mockResolvedValue({ instagramConnected: true })

    renderPage()

    await waitFor(() => {
      expect(mockedApi.getMetaPagePendingSelection).toHaveBeenCalledWith('pending-1')
    })
    expect(await screen.findByText('Página Pessoal')).toBeInTheDocument()
    expect(screen.getByText('EAI Jurídico')).toBeInTheDocument()
    expect(screen.getByText(/Instagram @eai.juridico/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Página Pessoal'))

    await waitFor(() => {
      expect(mockedApi.selectMetaPage).toHaveBeenCalledWith('pending-1', 'page-1')
    })
  })

  it('avisa que o Instagram não conectou quando a Página escolhida não tem conta Business vinculada', async () => {
    mockSearchParams = new URLSearchParams({ metaPagePending: 'pending-1' })
    mockedApi.getConnections.mockResolvedValue([])
    mockedApi.getMetaPagePendingSelection.mockResolvedValue([
      { id: 'page-1', name: 'Página sem Instagram' },
      { id: 'page-2', name: 'Outra Página' },
    ])
    mockedApi.selectMetaPage.mockResolvedValue({ instagramConnected: false })

    renderPage()

    fireEvent.click(await screen.findByText('Página sem Instagram'))

    await waitFor(() => {
      expect(screen.getByText(/Instagram NÃO foi conectado/)).toBeInTheDocument()
    })
  })

  it('explica o pré-requisito quando a conta não tem nenhuma Página do Facebook (metaResult=no-pages)', async () => {
    mockSearchParams = new URLSearchParams({ metaResult: 'no-pages' })
    mockedApi.getConnections.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/não encontramos nenhuma Página do Facebook/i)).toBeInTheDocument()
    })
  })

  it('mostra o aviso prévio sobre o pré-requisito do Instagram Business/Creator', async () => {
    mockedApi.getConnections.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Antes de conectar o Instagram ou o Facebook/)).toBeInTheDocument()
    })
  })

  it('oferece "Conectar sem Facebook" no card do Instagram, iniciando o Login do Instagram', async () => {
    mockedApi.getConnections.mockResolvedValue([])
    mockedApi.getAuthorizeUrl.mockResolvedValue('https://www.instagram.com/oauth/authorize?x=1')

    renderPage()

    const directButton = await screen.findByRole('button', { name: 'Conectar sem Facebook' })
    fireEvent.click(directButton)

    await waitFor(() => {
      expect(mockedApi.getAuthorizeUrl).toHaveBeenCalledWith('instagram')
    })
  })
})
