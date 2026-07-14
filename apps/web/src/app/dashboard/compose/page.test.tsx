import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ComposePage from './page'
import { api, type ApiBrandProfile } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getConnections: vi.fn(),
    getBrandProfile: vi.fn(),
    getPost: vi.fn(),
    getImageUrl: vi.fn(),
    createPost: vi.fn(),
    publishPost: vi.fn(),
    uploadImage: vi.fn(),
    uploadVideo: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeBrandProfile(overrides: Partial<ApiBrandProfile> = {}): ApiBrandProfile {
  return {
    id: 'bp-1',
    userId: 'user-1',
    brandId: 'brand-1',
    version: 1,
    business: { name: 'EAI? Jurídico', segment: 'LegalTech', description: '' },
    identity: { positioning: '', values: [] },
    visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
    voice: { tone: 'direto e didático', allowedVocabulary: [], prohibitedVocabulary: [] },
    narrative: { recurringThemes: [] },
    operation: {
      autonomyLevel: 'manual',
      autoPublishTopics: [],
      blockedTopics: [],
      maxAutoPostsPerDay: 1,
      stylePreferences: [],
    },
    createdAt: new Date().toISOString(),
    ...overrides,
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
        <ComposePage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getConnections.mockResolvedValue([])
})

describe('ComposePage — narração do Selfie', () => {
  it('lembra o tom de voz da marca quando o perfil carrega', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('EAI? Jurídico')
    })
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('direto e didático')
  })

  it('não narra nada sem tom de voz configurado', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(
      makeBrandProfile({ voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] } }),
    )

    renderPage()

    await screen.findByText('Novo Post')
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('')
  })
})
