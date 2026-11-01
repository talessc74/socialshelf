import { describe, it, expect, vi } from 'vitest'
import { Platform, TemplateStyle, AspectRatio, NO_CREDITS_AVAILABLE_MESSAGE, brasiliaMonthKey } from '@socialshelf/domain'
import type {
  ImageGeneratorPort,
  TemplateRendererPort,
  ImageStoragePort,
  GenerationRequestRepository,
  BrandProfileRepository,
  CreditBalanceRepository,
  CreditBalance,
  SubscriptionRepository,
  Subscription,
  BrandProfile,
  GenerationRequest,
} from '@socialshelf/domain'
import { EditArtifactUseCase } from './EditArtifactUseCase.js'

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    userId: 'user-1',
    tier: 'legacy',
    billingCycle: null,
    status: 'active',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    additionalProfessionalBrands: 0,
    adminOverrideUnlimited: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCreditBalance(overrides: Partial<CreditBalance> = {}): CreditBalance {
  const now = new Date()
  return {
    userId: 'user-1',
    periodKey: brasiliaMonthKey(now),
    planCreditsTotal: 100,
    planCreditsUsed: 0,
    purchasedCreditsBalance: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

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
  // 'legacy' (monthlyCreditsIncluded: null) não tem teto de plano — preserva o comportamento
  // destes testes de antes do reclamping por plano existir (_local-adr-policy-0NN).
  const creditFindByUserId = vi.fn().mockResolvedValue(null)
  const creditBalanceRepo: CreditBalanceRepository = {
    findByUserId: creditFindByUserId,
    save: vi.fn().mockResolvedValue(undefined),
    atomicUpdate: vi.fn(async (userId: string, mutate: (current: CreditBalance | null) => CreditBalance) => {
      const current = await creditFindByUserId(userId)
      return mutate(current)
    }),
    applyPurchaseOnce: vi.fn().mockResolvedValue(undefined),
  }
  const subscriptionRepo: SubscriptionRepository = {
    findByUserId: vi.fn().mockResolvedValue(makeSubscription()),
    save: vi.fn().mockResolvedValue(undefined),
  }

  return {
    imageGenerator,
    templateRenderer,
    imageStorage,
    generationRequestRepo,
    brandProfileRepo,
    creditBalanceRepo,
    subscriptionRepo,
  }
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
      deps.creditBalanceRepo,
      deps.subscriptionRepo,
    )

    const result = await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(result.outputs?.artifacts[0]?.status).toBe('ready')
    expect(result.outputs?.artifacts[0]?.imageStoragePath).toBe('brand-1/edited.png')
    expect(deps.imageGenerator.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', brandId: 'brand-1' }),
    )
  })

  it('recusa regenerar e marca o artefato como failed quando o saldo de créditos do mês acabou', async () => {
    const deps = makeDeps()
    ;(deps.subscriptionRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(makeSubscription({ tier: 'starter' }))
    ;(deps.creditBalanceRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeCreditBalance({ planCreditsTotal: 100, planCreditsUsed: 100 }),
    )
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.creditBalanceRepo,
      deps.subscriptionRepo,
    )

    const result = await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(result.outputs?.artifacts[0]?.status).toBe('failed')
    expect(result.outputs?.artifacts[0]?.error).toBe(NO_CREDITS_AVAILABLE_MESSAGE)
    expect(deps.imageGenerator.generateImage).not.toHaveBeenCalled()
  })

  it('desconta exatamente 1 crédito quando a edição tem sucesso', async () => {
    const deps = makeDeps()
    ;(deps.subscriptionRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(makeSubscription({ tier: 'starter' }))
    const balance = makeCreditBalance({ planCreditsTotal: 100, planCreditsUsed: 10 })
    ;(deps.creditBalanceRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(balance)
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.creditBalanceRepo,
      deps.subscriptionRepo,
    )

    await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(deps.creditBalanceRepo.atomicUpdate).toHaveBeenCalledTimes(1)
    const saved = await (deps.creditBalanceRepo.atomicUpdate as ReturnType<typeof vi.fn>).mock.results[0]!.value
    expect(saved.planCreditsUsed).toBe(11)
  })

  it('não desconta nada quando a edição falha', async () => {
    const deps = makeDeps()
    ;(deps.subscriptionRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(makeSubscription({ tier: 'starter' }))
    ;(deps.creditBalanceRepo.findByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeCreditBalance({ planCreditsTotal: 100, planCreditsUsed: 10 }),
    )
    ;(deps.imageGenerator.generateImage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('image gen failed'))
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.creditBalanceRepo,
      deps.subscriptionRepo,
    )

    const result = await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(result.outputs?.artifacts[0]?.status).toBe('failed')
    expect(deps.creditBalanceRepo.atomicUpdate).not.toHaveBeenCalled()
  })

  it('não bloqueia nem desconta saldo quando a conta é ilimitada (legacy/admin)', async () => {
    const deps = makeDeps()
    const useCase = new EditArtifactUseCase(
      deps.imageGenerator,
      deps.templateRenderer,
      deps.imageStorage,
      deps.generationRequestRepo,
      deps.brandProfileRepo,
      deps.creditBalanceRepo,
      deps.subscriptionRepo,
    )

    const result = await useCase.execute({ generationRequestId: 'gen-1', position: 1, instruction: 'fundo mais claro' })

    expect(result.outputs?.artifacts[0]?.status).toBe('ready')
    expect(deps.creditBalanceRepo.atomicUpdate).not.toHaveBeenCalled()
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
      deps.creditBalanceRepo,
      deps.subscriptionRepo,
    )

    await expect(
      useCase.execute({ generationRequestId: 'missing', position: 1, instruction: 'x' }),
    ).rejects.toThrow('Generation request not found')
  })
})
