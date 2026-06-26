import { describe, it, expect, vi } from 'vitest'
import { EditArtifactTextUseCase } from './EditArtifactTextUseCase.js'
import { AspectRatio, Platform, TemplateStyle } from '@socialshelf/domain'
import type {
  TemplateRendererPort,
  ImageStoragePort,
  GenerationRequestRepository,
  BrandProfileRepository,
  BrandProfile,
  GenerationRequest,
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
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
  createdAt: new Date(),
}

function makeRequest(overrides: Partial<GenerationRequest['outputs']> = {}): GenerationRequest {
  return {
    id: 'req-1',
    userId: 'brand-1',
    brandId: 'brand-1',
    status: 'ready',
    inputs: {
      description: 'desc',
      textContent: null,
      imageStoragePaths: [],
      targetPlatforms: [Platform.LINKEDIN],
      topicSuggestionId: null,
      aspectRatio: AspectRatio.SQUARE,
      style: TemplateStyle.BOLD_BOTTOM,
      includeBodyText: false,
    },
    outputs: {
      copies: {},
      cta: null,
      headlines: ['Headline original'],
      visualBriefs: ['Brief'],
      bodyTexts: ['Corpo original'],
      artifacts: [
        {
          position: 1,
          status: 'ready',
          imageStoragePath: 'brand-1/generated/req-1-123.png',
          backgroundImageStoragePath: 'brand-1/generated/req-1-bg-123.png',
          error: null,
        },
      ],
      ...overrides,
    },
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeDeps(request: GenerationRequest | null) {
  const templateRenderer: TemplateRendererPort = {
    render: vi.fn().mockResolvedValue({ base64: 'cmVuZGVyZWQ=', mimeType: 'image/png' }),
  }
  const imageStorage: ImageStoragePort = {
    upload: vi.fn().mockResolvedValue('brand-1/generated/req-1-456.png'),
    download: vi.fn().mockResolvedValue({ base64: 'YmFja2dyb3VuZA==', mimeType: 'image/png' }),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  }
  const generationRequestRepo: GenerationRequestRepository = {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(request),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    updateOutputs: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  }
  const brandProfileRepo: BrandProfileRepository = {
    save: vi.fn(),
    findLatestByBrand: vi.fn().mockResolvedValue(mockBrandProfile),
    findByBrandAndVersion: vi.fn(),
  }
  return { templateRenderer, imageStorage, generationRequestRepo, brandProfileRepo }
}

describe('EditArtifactTextUseCase', () => {
  it('renderiza o headline/body novos sobre o background salvo, sem chamar o gerador de imagem', async () => {
    const request = makeRequest()
    const deps = makeDeps(request)
    const useCase = new EditArtifactTextUseCase(
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
    )

    const result = await useCase.execute({
      generationRequestId: 'req-1',
      position: 1,
      headline: 'Novo headline',
      body: 'Novo corpo',
    })

    expect(deps.imageStorage.download).toHaveBeenCalledWith('brand-1/generated/req-1-bg-123.png')
    expect(deps.templateRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ headline: 'Novo headline', body: 'Novo corpo' }),
    )
    expect(result.outputs?.artifacts[0]?.status).toBe('ready')
    expect(result.outputs?.artifacts[0]?.imageStoragePath).toBe('brand-1/generated/req-1-456.png')
    expect(result.outputs?.headlines?.[0]).toBe('Novo headline')
    expect(result.outputs?.bodyTexts?.[0]).toBe('Novo corpo')
  })

  it('grava body vazio quando body é null', async () => {
    const request = makeRequest()
    const deps = makeDeps(request)
    const useCase = new EditArtifactTextUseCase(
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
    )

    const result = await useCase.execute({
      generationRequestId: 'req-1',
      position: 1,
      headline: 'Novo headline',
      body: null,
    })

    expect(deps.templateRenderer.render).toHaveBeenCalledWith(expect.objectContaining({ body: null }))
    expect(result.outputs?.bodyTexts?.[0]).toBe('')
  })

  it('lança erro quando a generation request não existe', async () => {
    const deps = makeDeps(null)
    const useCase = new EditArtifactTextUseCase(
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
    )

    await expect(
      useCase.execute({ generationRequestId: 'missing', position: 1, headline: 'x', body: null }),
    ).rejects.toThrow('not found')
  })

  it('lança erro quando o artefato não tem background salvo', async () => {
    const request = makeRequest()
    request.outputs!.artifacts[0]!.backgroundImageStoragePath = null
    const deps = makeDeps(request)
    const useCase = new EditArtifactTextUseCase(
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
    )

    await expect(
      useCase.execute({ generationRequestId: 'req-1', position: 1, headline: 'x', body: null }),
    ).rejects.toThrow('does not support direct text editing')
  })

  it('marca o artefato como failed se a renderização falhar', async () => {
    const request = makeRequest()
    const deps = makeDeps(request)
    ;(deps.templateRenderer.render as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('render failed'))
    const useCase = new EditArtifactTextUseCase(
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
    )

    const result = await useCase.execute({
      generationRequestId: 'req-1',
      position: 1,
      headline: 'Novo headline',
      body: null,
    })

    expect(result.outputs?.artifacts[0]?.status).toBe('failed')
    expect(result.outputs?.artifacts[0]?.error).toBe('render failed')
  })
})
