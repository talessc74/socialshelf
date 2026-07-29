import { describe, it, expect, vi } from 'vitest'
import { Platform, TemplateStyle, AspectRatio, AI_SPENDING_LIMIT_REACHED_MESSAGE } from '@socialshelf/domain'
import type {
  ImageGeneratorPort,
  TemplateRendererPort,
  ImageStoragePort,
  GenerationRequestRepository,
  BrandProfileRepository,
  AiSpendingGuardPort,
  BrandProfile,
  GenerationRequest,
} from '@socialshelf/domain'
import { EditArtifactUseCase } from './EditArtifactUseCase.js'

const mockBrandProfile: BrandProfile = {
  id: 'profile-1',
  userId: 'user-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: {
    autonomyLevel: 'manual',
    autoPublishTopics: [],
    blockedTopics: [],
    maxAutoPostsPerDay: 1,
    stylePreferences: [],
    dailyAiSpendingLimitBrl: null,
  },
  createdAt: new Date(),
}

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    id: 'gen-1',
    userId: 'user-1',
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
      headlines: ['Headline'],
      visualBriefs: ['Cena'],
      bodyTexts: [''],
      artifacts: [
        { position: 1, status: 'ready', imageStoragePath: 'brand-1/img.png', backgroundImageStoragePath: 'brand-1/bg.png', error: null },
      ],
    },
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeDeps(request: GenerationRequest = makeRequest()) {
  const imageGenerator: ImageGeneratorPort = {
    generateImage: vi.fn().mockResolvedValue({ base64: 'aW1hZ2Vt', mimeType: 'image/png' }),
  }
  const templateRenderer: TemplateRendererPort = {
    render: vi.fn().mockResolvedValue({ base64: 'cmVuZGVyZWQ=', mimeType: 'image/png' }),
  }
  const imageStorage: ImageStoragePort = {
    upload: vi.fn().mockResolvedValue('brand-1/edited.png'),
    download: vi.fn().mockResolvedValue({ base64: 'ZG93bmxvYWRlZA==', mimeType: 'image/png' }),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  }
  const generationRequestRepo: GenerationRequestRepository = {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(request),
    updateStatus: vi.fn(),
    updateOutputs: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
  }
  const brandProfileRepo: BrandProfileRepository = {
    save: vi.fn(),
    findLatestByBrand: vi.fn().mockResolvedValue(mockBrandProfile),
    findByBrandAndVersion: vi.fn(),
  }
  const aiSpendingGuard: AiSpendingGuardPort = {
    sumCostUsdSince: vi.fn().mockResolvedValue(0),
  }

  return { imageGenerator, templateRenderer, imageStorage, generationRequestRepo, brandProfileRepo, aiSpendingGuard }
}

describe('EditArtifactUseCase', () => {
  it('regenera a imagem do artefato com sucesso', async () => {
    const deps = makeDeps()
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.aiSpendingGuard,
    )

    const result = await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(result.outputs?.artifacts[0]?.status).toBe('ready')
    expect(result.outputs?.artifacts[0]?.imageStoragePath).toBe('brand-1/edited.png')
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', brandId: 'brand-1' }),
    )
  })

  it('recusa regenerar e marca o artefato como failed quando o limite diário de gasto foi atingido', async () => {
    const deps = makeDeps()
    ;(deps.brandProfileRepo.findLatestByBrand as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockBrandProfile,
      operation: { ...mockBrandProfile.operation, dailyAiSpendingLimitBrl: 1 },
    })
    ;(deps.aiSpendingGuard.sumCostUsdSince as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.aiSpendingGuard,
    )

    const result = await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(result.outputs?.artifacts[0]?.status).toBe('failed')
    expect(result.outputs?.artifacts[0]?.error).toBe(AI_SPENDING_LIMIT_REACHED_MESSAGE)
    expect(deps.imageGenerator.generateImage).not.toHaveBeenCalled()
  })

  it('não consulta o gasto quando a marca não configurou limite diário', async () => {
    const deps = makeDeps()
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.aiSpendingGuard,
    )

    await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(deps.aiSpendingGuard.sumCostUsdSince).not.toHaveBeenCalled()
  })

  it('lança quando a requisição não existe', async () => {
    const deps = makeDeps()
    ;(deps.generationRequestRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.aiSpendingGuard,
    )

    await expect(
      useCase.execute({ generationRequestId: 'missing', position: 1, instruction: 'x' }),
    ).rejects.toThrow('Generation request not found')
  })
})
