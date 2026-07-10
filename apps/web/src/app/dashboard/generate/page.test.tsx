import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform, AspectRatio, TemplateStyle } from '@socialshelf/domain'
import GenerateContentPage from './page'
import { api, type ApiConnection, type ApiGenerationRequest, type ApiTopicSuggestion } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getConnections: vi.fn(),
    getTopicSuggestions: vi.fn(),
    getBrandProfile: vi.fn(),
    generateContent: vi.fn(),
    getImageUrl: vi.fn(),
    createPost: vi.fn(),
    publishPost: vi.fn(),
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
  window.sessionStorage.clear()
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
      articleUrl: 'https://news.google.com/rss/articles/abc',
      rationale: 'rationale',
      audienceFitScore: 0.8,
      thumbnailUrl: null,
      publishedPlatforms: [],
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
        topicSuggestionId: null,
        aspectRatio: AspectRatio.SQUARE,
        style: TemplateStyle.BOLD_BOTTOM,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        headlines: ['Headline gerada'],
        bodyTexts: null,
        artifacts: [
          {
            position: 1,
            status: 'ready',
            imageStoragePath: 'user-1/generated/img.png',
            backgroundImageStoragePath: 'user-1/generated/img-bg.png',
            error: null,
          },
        ],
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

  it('permite publicar o rascunho gerado a partir do resultado', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
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
        topicSuggestionId: null,
        aspectRatio: AspectRatio.SQUARE,
        style: TemplateStyle.BOLD_BOTTOM,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        headlines: ['Headline gerada'],
        bodyTexts: null,
        artifacts: [
          {
            position: 1,
            status: 'ready',
            imageStoragePath: 'user-1/generated/img.png',
            backgroundImageStoragePath: 'user-1/generated/img-bg.png',
            error: null,
          },
        ],
      },
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.getImageUrl.mockResolvedValue('https://storage.googleapis.com/signed-url')
    mockedApi.createPost.mockResolvedValue({
      id: 'post-1',
      userId: 'user-1',
      brandId: 'user-1',
      brandProfileVersion: null,
      content: [{ platform: Platform.LINKEDIN, text: 'Copy gerada para o LinkedIn' }],
      imageStoragePaths: ['user-1/generated/img.png'],
      videoStoragePath: null,
      status: 'draft',
      origin: 'manual',
      externalIds: {},
      scheduledAt: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.publishPost.mockResolvedValue({
      postId: 'post-1',
      results: [{ platform: Platform.LINKEDIN, externalId: 'ext-1', publishedAt: new Date().toISOString() }],
      failedPlatforms: [],
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))

    await user.click(await screen.findByRole('button', { name: 'Publicar Agora' }))

    expect(await screen.findByText('Publicado com sucesso:')).toBeInTheDocument()
    expect(mockedApi.createPost).toHaveBeenCalledWith(
      [{ platform: Platform.LINKEDIN, text: 'Copy gerada para o LinkedIn' }],
      ['user-1/generated/img.png'],
      undefined,
      null,
    )
    expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1')
  })

  it('permite publicar também em uma plataforma conectada adicional após publicar', async () => {
    mockedApi.getConnections.mockResolvedValue([
      makeConnection(Platform.LINKEDIN),
      makeConnection(Platform.FACEBOOK),
    ])
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
        topicSuggestionId: null,
        aspectRatio: AspectRatio.SQUARE,
        style: TemplateStyle.BOLD_BOTTOM,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        headlines: ['Headline gerada'],
        bodyTexts: null,
        artifacts: [
          {
            position: 1,
            status: 'ready',
            imageStoragePath: 'user-1/generated/img.png',
            backgroundImageStoragePath: 'user-1/generated/img-bg.png',
            error: null,
          },
        ],
      },
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.getImageUrl.mockResolvedValue('https://storage.googleapis.com/signed-url')
    mockedApi.createPost.mockResolvedValueOnce({
      id: 'post-1',
      userId: 'user-1',
      brandId: 'user-1',
      brandProfileVersion: null,
      content: [{ platform: Platform.LINKEDIN, text: 'Copy gerada para o LinkedIn' }],
      imageStoragePaths: ['user-1/generated/img.png'],
      videoStoragePath: null,
      status: 'draft',
      origin: 'manual',
      externalIds: {},
      scheduledAt: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.publishPost.mockResolvedValueOnce({
      postId: 'post-1',
      results: [{ platform: Platform.LINKEDIN, externalId: 'ext-1', publishedAt: new Date().toISOString() }],
      failedPlatforms: [],
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))
    await user.click(await screen.findByRole('button', { name: 'Publicar Agora' }))

    expect(await screen.findByText('Publicar também em:')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'LinkedIn' })).not.toBeInTheDocument()

    mockedApi.createPost.mockResolvedValueOnce({
      id: 'post-2',
      userId: 'user-1',
      brandId: 'user-1',
      brandProfileVersion: null,
      content: [{ platform: Platform.FACEBOOK, text: 'Copy gerada para o LinkedIn' }],
      imageStoragePaths: ['user-1/generated/img.png'],
      videoStoragePath: null,
      status: 'draft',
      origin: 'manual',
      externalIds: {},
      scheduledAt: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.publishPost.mockResolvedValueOnce({
      postId: 'post-2',
      results: [{ platform: Platform.FACEBOOK, externalId: 'ext-2', publishedAt: new Date().toISOString() }],
      failedPlatforms: [],
    })

    await user.click(screen.getByRole('button', { name: 'Facebook' }))
    expect(await screen.findByText('Texto que será publicado (reaproveitado da copy gerada):')).toBeInTheDocument()
    expect(screen.getAllByText('Copy gerada para o LinkedIn')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Publicar nas redes selecionadas' }))

    await waitFor(() => {
      expect(mockedApi.createPost).toHaveBeenCalledWith(
        [{ platform: Platform.FACEBOOK, text: 'Copy gerada para o LinkedIn' }],
        ['user-1/generated/img.png'],
        undefined,
        null,
      )
    })
    expect(mockedApi.publishPost).toHaveBeenCalledWith('post-2')
    expect(await screen.findAllByText('✓ Facebook')).toHaveLength(1)
  })

  it('desabilita plataforma adicional que exige imagem quando não há artefato pronto', async () => {
    mockedApi.getConnections.mockResolvedValue([
      makeConnection(Platform.LINKEDIN),
      makeConnection(Platform.INSTAGRAM),
    ])
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
        topicSuggestionId: null,
        aspectRatio: AspectRatio.SQUARE,
        style: TemplateStyle.BOLD_BOTTOM,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        headlines: ['Headline gerada'],
        bodyTexts: null,
        artifacts: [],
      },
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.createPost.mockResolvedValueOnce({
      id: 'post-1',
      userId: 'user-1',
      brandId: 'user-1',
      brandProfileVersion: null,
      content: [{ platform: Platform.LINKEDIN, text: 'Copy gerada para o LinkedIn' }],
      imageStoragePaths: [],
      videoStoragePath: null,
      status: 'draft',
      origin: 'manual',
      externalIds: {},
      scheduledAt: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    mockedApi.publishPost.mockResolvedValueOnce({
      postId: 'post-1',
      results: [{ platform: Platform.LINKEDIN, externalId: 'ext-1', publishedAt: new Date().toISOString() }],
      failedPlatforms: [],
    })

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))
    await user.click(await screen.findByRole('button', { name: 'Publicar Agora' }))

    const instagramButton = await screen.findByRole('button', { name: 'Instagram' })
    expect(instagramButton).toBeDisabled()
    expect(instagramButton).toHaveAttribute('title', 'Exige imagem — este post não tem imagem.')

    await user.click(instagramButton)
    expect(screen.queryByText('Texto que será publicado (reaproveitado da copy gerada):')).not.toBeInTheDocument()
    expect(mockedApi.createPost).toHaveBeenCalledTimes(1)
  })

  it('ignora plataformas conectadas com valor inválido ao renderizar os botões', async () => {
    const invalidConnection = { ...makeConnection(Platform.LINKEDIN), platform: 'LinkedIn' as Platform }
    mockedApi.getConnections.mockResolvedValue([invalidConnection, makeConnection(Platform.TWITTER)])

    renderPage()

    expect(await screen.findByText('X (Twitter)')).toBeInTheDocument()
    expect(screen.queryByText('LinkedIn')).not.toBeInTheDocument()
  })

  it('envia includeBodyText quando o checkbox de texto de apoio é marcado', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])
    mockedApi.generateContent.mockReturnValue(new Promise(() => {}))

    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/Lançamento da nova funcionalidade/), 'Lançamento X')
    await user.click(await screen.findByText('LinkedIn'))
    // O checkbox de texto de apoio só aparece em estilos com barra de texto; "Sem texto" é o default.
    await user.click(screen.getByText('Faixa inferior'))
    await user.click(screen.getByText('Incluir texto de apoio (parágrafo curto abaixo do headline)'))
    await user.click(screen.getByRole('button', { name: 'Gerar Conteúdo' }))

    expect(mockedApi.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ includeBodyText: true }),
    )
  })

  it('não mostra o checkbox de texto de apoio quando o estilo "Sem texto" está selecionado', async () => {
    mockedApi.getConnections.mockResolvedValue([makeConnection(Platform.LINKEDIN)])

    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByText('Sem texto'))

    expect(screen.queryByText('Incluir texto de apoio (parágrafo curto abaixo do headline)')).not.toBeInTheDocument()
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
        topicSuggestionId: null,
        aspectRatio: AspectRatio.SQUARE,
        style: TemplateStyle.BOLD_BOTTOM,
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
        topicSuggestionId: null,
        aspectRatio: AspectRatio.SQUARE,
        style: TemplateStyle.BOLD_BOTTOM,
      },
      outputs: {
        copies: { [Platform.LINKEDIN]: { text: 'Copy gerada para o LinkedIn', charCount: 27 } },
        cta: 'Comente abaixo!',
        headlines: ['Headline gerada'],
        bodyTexts: null,
        artifacts: [
          {
            position: 1,
            status: 'ready',
            imageStoragePath: 'user-1/generated/img-1.png',
            backgroundImageStoragePath: 'user-1/generated/img-1-bg.png',
            error: null,
          },
          {
            position: 2,
            status: 'failed',
            imageStoragePath: null,
            backgroundImageStoragePath: null,
            error: 'Imagen timeout',
          },
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
