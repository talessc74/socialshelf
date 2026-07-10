import { describe, it, expect, vi } from 'vitest'
import { GenerateContentUseCase } from './GenerateContentUseCase.js'
import { Platform, TemplateStyle, AspectRatio } from '@socialshelf/domain'
import type {
  CopyGeneratorPort,
  ArtDirectorPort,
  ImageGeneratorPort,
  TemplateRendererPort,
  ImageStoragePort,
  GenerationRequestRepository,
  PostRepository,
  BrandProfileRepository,
  TopicSuggestionRepository,
  BrandProfile,
  TopicSuggestion,
} from '@socialshelf/domain'

const mockBrandProfile: BrandProfile = {
  id: 'profile-1',
  userId: 'brand-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1 },
  createdAt: new Date(),
}

function makeDeps(
  overrides: { copyFails?: boolean; imageFailsAt?: number[]; headlineCount?: number; artDirectionFails?: boolean } = {},
) {
  const headlineCount = overrides.headlineCount ?? 1
  const headlines = Array.from({ length: headlineCount }, (_, i) => `Headline gerada ${i + 1}`)
  const visualBriefs = Array.from({ length: headlineCount }, (_, i) => `Cena gerada ${i + 1}`)
  const bodyTexts = Array.from({ length: headlineCount }, (_, i) => `Corpo gerado ${i + 1}`)
  const copyGenerator: CopyGeneratorPort = {
    generateCopy: overrides.copyFails
      ? vi.fn().mockRejectedValue(new Error('copy generation failed'))
      : vi.fn().mockResolvedValue({
          copies: { [Platform.LINKEDIN]: { text: 'Generated copy', charCount: 14 } },
          cta: 'Comente abaixo!',
          headlines,
          visualBriefs,
          bodyTexts,
        }),
  }

  const artDirector: ArtDirectorPort = {
    direct: overrides.artDirectionFails
      ? vi.fn().mockRejectedValue(new Error('art direction failed'))
      : vi.fn().mockImplementation((input: { artifacts: Array<{ position: number; visualBrief: string }> }) =>
          Promise.resolve({
            artifacts: input.artifacts.map((a) => ({
              position: a.position,
              imagePrompt: `${a.visualBrief} (direcionado)`,
              negativePrompt: 'cluttered background, busy patterns',
            })),
          }),
        ),
  }

  const failPositions = new Set(overrides.imageFailsAt ?? [])
  const imageGenerator: ImageGeneratorPort = {
    generateImage: vi.fn().mockImplementation((prompt: { position: number }) => {
      if (failPositions.has(prompt.position)) return Promise.reject(new Error('image gen failed'))
      return Promise.resolve({ base64: 'YmFzZTY0', mimeType: 'image/png' })
    }),
  }

  const templateRenderer: TemplateRendererPort = {
    render: vi.fn().mockResolvedValue({ base64: 'cmVuZGVyZWQ=', mimeType: 'image/png' }),
  }

  const imageStorage: ImageStoragePort = {
    upload: vi.fn().mockResolvedValue('brand-1/generated/img.png'),
    download: vi.fn().mockResolvedValue({ base64: 'dXBsb2FkZWQ=', mimeType: 'image/png' }),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  }

  const generationRequestRepo: GenerationRequestRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    updateOutputs: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  }

  const postRepo: PostRepository = {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByIdAndBrand: vi.fn(),
    claimForPublishing: vi.fn(),
    findByBrand: vi.fn(),
    findScheduledBefore: vi.fn(),
    delete: vi.fn(),
  }

  const brandProfileRepo: BrandProfileRepository = {
    save: vi.fn(),
    findLatestByBrand: vi.fn().mockResolvedValue(mockBrandProfile),
    findByBrandAndVersion: vi.fn(),
  }

  const topicSuggestionRepo: TopicSuggestionRepository = {
    save: vi.fn(),
    findLatestByBrand: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
  }

  return {
    copyGenerator,
    artDirector,
    imageGenerator,
    templateRenderer,
    imageStorage,
    generationRequestRepo,
    postRepo,
    brandProfileRepo,
    topicSuggestionRepo,
  }
}

function baseInput() {
  return {
    userId: 'brand-1',
    brandId: 'brand-1',
    description: 'Post sobre lançamento de produto',
    textContent: null,
    imageStoragePaths: [],
    targetPlatforms: [Platform.LINKEDIN],
    topicSuggestionId: null,
    style: TemplateStyle.BOLD_BOTTOM,
    aspectRatio: AspectRatio.SQUARE,
    includeBodyText: false,
  }
}

describe('GenerateContentUseCase', () => {
  it('gera um único artefato (post simples) e cria o post em ai-draft', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.status).toBe('ready')
    expect(result.outputs?.artifacts).toHaveLength(1)
    expect(result.outputs?.artifacts[0]?.status).toBe('ready')
    expect(deps.postRepo.save).toHaveBeenCalledTimes(1)
    const savedPost = (deps.postRepo.save as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(savedPost.status).toBe('ai-draft')
    expect(savedPost.imageStoragePaths).toEqual(['brand-1/generated/img.png'])
  })

  it('persiste o background limpo (sem texto) separado da imagem final, quando a imagem é gerada por IA', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.outputs?.artifacts[0]?.backgroundImageStoragePath).toBe('brand-1/generated/img.png')
    expect(deps.imageStorage.upload).toHaveBeenCalledWith(
      'brand-1',
      'brand-1',
      Buffer.from('YmFzZTY0', 'base64'),
      'image/png',
      `${result.id}-bg`,
    )
  })

  it('reaproveita o caminho da foto enviada como background, sem upload extra, quando o usuário fornece a imagem', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute({
      ...baseInput(),
      imageStoragePaths: ['brand-1/uploads/foto.png'],
    })

    expect(result.outputs?.artifacts[0]?.backgroundImageStoragePath).toBe('brand-1/uploads/foto.png')
    expect(deps.imageStorage.upload).toHaveBeenCalledTimes(1)
    expect(deps.imageGenerator.generateImage).not.toHaveBeenCalled()
  })

  it('gera múltiplos artefatos (carrossel) sem bifurcação de lógica', async () => {
    const deps = makeDeps({ headlineCount: 3 })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.status).toBe('ready')
    expect(result.outputs?.artifacts).toHaveLength(3)
    expect(result.outputs?.artifacts.every((a) => a.status === 'ready')).toBe(true)
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledTimes(3)
    const savedPost = (deps.postRepo.save as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(savedPost.imageStoragePaths).toHaveLength(3)
  })

  it('marca a requisição como failed quando a geração de copy falha, sem tentar imagens', async () => {
    const deps = makeDeps({ copyFails: true })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.status).toBe('failed')
    expect(result.error).toBe('copy generation failed')
    expect(deps.imageGenerator.generateImage).not.toHaveBeenCalled()
    expect(deps.postRepo.save).not.toHaveBeenCalled()
  })

  it('cria o post só com os artefatos que tiveram sucesso quando parte do carrossel falha', async () => {
    const deps = makeDeps({ imageFailsAt: [2], headlineCount: 3 })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.status).toBe('ready')
    expect(result.outputs?.artifacts.filter((a) => a.status === 'ready')).toHaveLength(2)
    expect(result.outputs?.artifacts.filter((a) => a.status === 'failed')).toHaveLength(1)
    const savedPost = (deps.postRepo.save as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(savedPost.imageStoragePaths).toHaveLength(2)
  })

  it('marca a requisição como failed quando todos os artefatos falham', async () => {
    const deps = makeDeps({ imageFailsAt: [1, 2], headlineCount: 2 })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.status).toBe('failed')
    expect(result.error).toBe('All artifacts failed to generate')
    expect(deps.postRepo.save).not.toHaveBeenCalled()
  })

  it('busca a TopicSuggestion vinculada e passa como pautaContext para a copy', async () => {
    const deps = makeDeps()
    const suggestion: TopicSuggestion = {
      id: 'suggestion-1',
      brandId: 'brand-1',
      headline: 'Notícia verificada',
      summary: 'Resumo',
      sourceUrl: 'https://reuters.com/article',
      sourceDomain: 'reuters.com',
      articleUrl: 'https://news.google.com/rss/articles/abc',
      rationale: 'Casa com tema recorrente',
      audienceFitScore: 2,
      thumbnailUrl: null,
      createdAt: new Date(),
    }
    ;(deps.topicSuggestionRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(suggestion)

    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute({ ...baseInput(), topicSuggestionId: 'suggestion-1' })

    expect(deps.copyGenerator.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({
        pautaContext: { headline: 'Notícia verificada', rationale: 'Casa com tema recorrente' },
      }),
    )
  })

  it('passa a voz da marca carregada para a geração de copy', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute(baseInput())

    expect(deps.copyGenerator.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({ brandVoice: mockBrandProfile.voice }),
    )
  })

  it('passa a identidade do negócio carregada para a geração de copy', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute(baseInput())

    expect(deps.copyGenerator.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({ brandBusiness: mockBrandProfile.business }),
    )
  })

  it('trunca a copy para o limite da plataforma quando a IA ignora o limite informado no prompt', async () => {
    const deps = makeDeps()
    const oversizedText = 'a'.repeat(2433)
    ;(deps.copyGenerator.generateCopy as ReturnType<typeof vi.fn>).mockResolvedValue({
      copies: { [Platform.INSTAGRAM]: { text: oversizedText, charCount: 2433 } },
      cta: 'Comente abaixo!',
      headlines: ['Headline gerada 1'],
      visualBriefs: ['Cena gerada 1'],
      bodyTexts: [''],
    })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute({ ...baseInput(), targetPlatforms: [Platform.INSTAGRAM] })

    const copy = result.outputs?.copies[Platform.INSTAGRAM]
    expect(copy?.text.length).toBeLessThanOrEqual(2200)
    expect(copy?.charCount).toBe(copy?.text.length)
    expect(copy?.text.endsWith('…')).toBe(true)
    const savedPost = (deps.postRepo.save as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect(savedPost.content[0].text.length).toBeLessThanOrEqual(2200)
  })

  it('passa brandVoice null quando não há perfil de marca cadastrado', async () => {
    const deps = makeDeps()
    ;(deps.brandProfileRepo.findLatestByBrand as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute(baseInput())

    expect(deps.copyGenerator.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({ brandVoice: null, brandBusiness: null }),
    )
  })

  it('usa o imagePrompt do diretor de arte em vez do visualBrief cru ao gerar a imagem', async () => {
    const deps = makeDeps({ headlineCount: 2 })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute(baseInput())

    expect(deps.artDirector.direct).toHaveBeenCalledTimes(1)
    expect(deps.artDirector.direct).toHaveBeenCalledWith(
      expect.objectContaining({
        description: baseInput().description,
        artifacts: [
          { position: 1, headline: 'Headline gerada 1', visualBrief: 'Cena gerada 1' },
          { position: 2, headline: 'Headline gerada 2', visualBrief: 'Cena gerada 2' },
        ],
      }),
    )
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Cena gerada 1 (direcionado)', negativePrompt: 'cluttered background, busy patterns' }),
    )
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Cena gerada 2 (direcionado)', negativePrompt: 'cluttered background, busy patterns' }),
    )
  })

  it('usa o visualBrief cru quando o diretor de arte falha, sem travar a geração', async () => {
    const deps = makeDeps({ artDirectionFails: true })
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    const result = await useCase.execute(baseInput())

    expect(result.status).toBe('ready')
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Cena gerada 1' }),
    )
  })

  it('não chama o diretor de arte quando o usuário envia as próprias fotos', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute({ ...baseInput(), imageStoragePaths: ['brand-1/uploads/foto.png'] })

    expect(deps.artDirector.direct).not.toHaveBeenCalled()
    expect(deps.imageGenerator.generateImage).not.toHaveBeenCalled()
  })

  it('repassa includeBodyText para o gerador de copy e desenha o bodyText quando habilitado', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute({ ...baseInput(), includeBodyText: true })

    expect(deps.copyGenerator.generateCopy).toHaveBeenCalledWith(
      expect.objectContaining({ includeBodyText: true }),
    )
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ hasBodyOverlay: true }),
    )
    expect(deps.templateRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Corpo gerado 1' }),
    )
  })

  it('não desenha bodyText quando includeBodyText está desabilitado, mesmo que a copy retorne um', async () => {
    const deps = makeDeps()
    const useCase = new GenerateContentUseCase(
      deps.copyGenerator,
      deps.artDirector,
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.postRepo,
      deps.brandProfileRepo,
      deps.topicSuggestionRepo,
    )

    await useCase.execute({ ...baseInput(), includeBodyText: false })

    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ hasBodyOverlay: false }),
    )
    expect(deps.templateRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ body: null }),
    )
  })
})
