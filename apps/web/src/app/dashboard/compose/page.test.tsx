import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import ComposePage from './page'
import { api, type ApiBrandProfile, type ApiPost, type ApiConnection } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => mockSearchParams,
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
      dailyAiSpendingLimitBrl: null,
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
  mockSearchParams = new URLSearchParams()
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

function makeConnection(platform: Platform): ApiConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: `pw-${platform}`,
    tokenRef: 'tok',
    scopes: [],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ApiConnection
}

describe('ComposePage — repostar', () => {
  it('não republica no X (indisponível "em breve") mesmo quando o post original tinha X no conteúdo', async () => {
    mockSearchParams = new URLSearchParams({ repostFrom: 'post-1' })
    mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())
    mockedApi.getConnections.mockResolvedValue([
      makeConnection(Platform.INSTAGRAM),
      makeConnection(Platform.TWITTER),
    ])
    mockedApi.getImageUrl.mockResolvedValue('data:image/png;base64,AAAA')
    mockedApi.getPost.mockResolvedValue({
      id: 'post-1',
      userId: 'user-1',
      brandId: 'brand-1',
      brandProfileVersion: 1,
      content: [
        { platform: Platform.TWITTER, text: 'Texto do post para repostar' },
        { platform: Platform.INSTAGRAM, text: 'Texto do post para repostar' },
      ],
      imageStoragePaths: ['img-1.png'],
      videoStoragePath: null,
      status: 'published',
      origin: 'manual',
      campaignId: null,
      externalIds: {},
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ApiPost)
    mockedApi.createPost.mockResolvedValue({ id: 'new-post' } as ApiPost)
    mockedApi.publishPost.mockResolvedValue({ postId: 'new-post', results: [], failedPlatforms: [] })

    renderPage()

    await screen.findByText('Repostar')
    const publishBtn = await screen.findByRole('button', { name: /Publicar Agora/ })
    await waitFor(() => expect(publishBtn).toBeEnabled())
    fireEvent.click(publishBtn)

    await waitFor(() => expect(mockedApi.createPost).toHaveBeenCalled())
    const content = mockedApi.createPost.mock.calls[0]![0] as Array<{ platform: Platform }>
    const platforms = content.map((c) => c.platform)
    expect(platforms).toContain(Platform.INSTAGRAM)
    expect(platforms).not.toContain(Platform.TWITTER)
  })
})
