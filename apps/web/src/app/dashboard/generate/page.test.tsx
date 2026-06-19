import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import GenerateContentPage from './page'
import { api, type ApiConnection, type ApiGenerationRequest, type ApiTopicSuggestion } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getConnections: vi.fn(),
    getTopicSuggestions: vi.fn(),
    getBrandProfile: vi.fn(),
    generateContent: vi.fn(),
    getImageUrl: vi.fn(),
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
      <GenerateContentPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getTopicSuggestions.mockResolvedValue([])
  mockedApi.getBrandProfile.mockResolvedValue(null)
})

describe('GenerateContentPage', () => {
  it('exibe os botões das plataformas conectadas', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])

    renderPage()

    expect(await screen.findByText('LinkedIn')).toBeInTheDocument()
  })

  it('mostra mensagem quando não há plataforma conectada', async () => {
    mockedApi.getConnections.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Nenhuma plataforma conectada.')).toBeInTheDocument()
  })

  it('mantém "Gerar Conteúdo" desabilitado até descrição e plataforma serem preenchidas', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    const user = userEvent.setup()

    renderPage()

    const submitButton = screen.getByRole('button', { name: 'Gerar Conteúdo' })
    expect(submitButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    expect(submitButton).toBeDisabled()

    await user.click(await screen.findByText('LinkedIn'))
    expect(submitButton).toBeEnabled()
  })

  it('mostra a pauta sugerida quando há TopicSuggestion disponível', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    const suggestion: ApiTopicSuggestion = {
      id: 'suggestion-1',
      brandId: 'user-1',
      headline: 'Nova regulação do setor',
      summary: 'resumo',
      sourceUrl: 'https://example.com',
      sourceDomain: 'example.com',
      rationale: 'rationale',
      audienceFitScore: 0.8,
      createdAt: new Date().toISOString(),
    }
    mockedApi.getTopicSuggestions.mockResolvedValue([suggestion])

    renderPage()

    expect(await screen.findByText('Nova regulação do setor')).toBeInTheDocument()
  })

  it('ao submeter, mostra o estado de carregamento e depois o resultado com copy, CTA e imagem', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    let resolveGenerate!: (value: ApiGenerationRequest) => void
    mockedApi.generateContent.mockReturnValue(
      new Promise((resolve) => {
        resolveGenerate = resolve
      }),
    )
    mockedApi.getImageUrl.mockResolvedValue('https://storage.googleapis.com/signed-url')

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))

    expect(await screen.findByText('Lendo a voz da marca…')).toBeInTheDocument()

    resolveGenerate({
      id: 'gen-1',
      userId: 'user-1',
      brandId: 'user-1',
      status: 'ready',
      inputs: {
        description: 'Lançamento X',
        textContent: null,
        imageStoragePaths: [],
        targetPlatforms: [Platform.LINKEDIN],
        artifactCount: 1,
        topicSuggestionId: null,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        artifacts: [{ position: 1, status: 'ready', imageStoragePath: 'user-1/generated/img.png', error: null }],
      },
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    expect(await screen.findByText('Resultado da Geração')).toBeInTheDocument()
    expect(screen.getByText('Copy gerada para o LinkedIn')).toBeInTheDocument()
    expect(screen.getByText('Comente abaixo!')).toBeInTheDocument()
    expect(screen.getByText(/Rascunho criado com sucesso/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Artefato gerado' })).toHaveAttribute(
        'src',
        'https://storage.googleapis.com/signed-url',
      )
    })
  })

  it('mostra mensagem de erro quando a chamada de geração falha', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    mockedApi.generateContent.mockRejectedValue(new Error('Generator error'))

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))

    expect(await screen.findByText('Generator error')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gerar Conteúdo' })).toBeInTheDocument()
  })

  it('mostra falha geral quando o generationRequest retorna status failed', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    mockedApi.generateContent.mockResolvedValue({
      id: 'gen-1',
      userId: 'user-1',
      brandId: 'user-1',
      status: 'failed',
      inputs: {
        description: 'Lançamento X',
        textContent: null,
        imageStoragePaths: [],
        targetPlatforms: [Platform.LINKEDIN],
        artifactCount: 1,
        topicSuggestionId: null,
      },
      outputs: null,
      error: 'All artifacts failed to generate',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))

    expect(await screen.findByText(/Falha na geração: All artifacts failed to generate/)).toBeInTheDocument()
  })

  it('exibe o status de cada artefato em um carrossel com falha parcial', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    mockedApi.getImageUrl.mockResolvedValue('https://storage.googleapis.com/signed-url')
    mockedApi.generateContent.mockResolvedValue({
      id: 'gen-1',
      userId: 'user-1',
      brandId: 'user-1',
      status: 'ready',
      inputs: {
        description: 'Lançamento X',
        textContent: null,
        imageStoragePaths: [],
        targetPlatforms: [Platform.LINKEDIN],
        artifactCount: 2,
        topicSuggestionId: null,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        artifacts: [
          { position: 1, status: 'ready', imageStoragePath: 'user-1/generated/img-1.png', error: null },
          { position: 2, status: 'failed', imageStoragePath: null, error: 'Imagen timeout' },
        ],
      },
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))

    expect(await screen.findByText('Carrossel')).toBeInTheDocument()
    expect(screen.getByText('Falhou')).toBeInTheDocument()
    expect(screen.getByText(/Rascunho criado com sucesso/)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Artefato gerado' })).toBeInTheDocument()
    })
  })
})
