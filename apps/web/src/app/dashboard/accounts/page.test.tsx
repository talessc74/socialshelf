import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import AccountsPage from './page'
import { api, type ApiConnection } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getConnections: vi.fn(),
    getAuthorizeUrl: vi.fn(),
    getLinkedInPageAuthorizeUrl: vi.fn(),
    getLinkedInPagePendingSelection: vi.fn(),
    selectLinkedInPage: vi.fn(),
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
