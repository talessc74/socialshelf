import {
  TemplateStyle,
  NO_CREDITS_AVAILABLE_MESSAGE,
  resolveEffectivePlanLimits,
  resolveEffectiveCreditState,
  applyCreditConsumption,
} from '@socialshelf/domain'
import type {
  ImageGeneratorPort,
  TemplateRendererPort,
  ImageStoragePort,
  GenerationRequestRepository,
  BrandProfileRepository,
  CreditBalanceRepository,
  SubscriptionRepository,
  GenerationRequest,
} from '@socialshelf/domain'
import { hasCreditsAvailable } from '../lib/creditSpending.js'

export interface EditArtifactInput {
  generationRequestId: string
  position: number
  instruction: string
}

export class EditArtifactUseCase {
  constructor(
    private readonly imageGenerator: ImageGeneratorPort,
    private readonly templateRenderer: TemplateRendererPort,
    private readonly imageStorage: ImageStoragePort,
    private readonly generationRequestRepo: GenerationRequestRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly creditBalanceRepo: CreditBalanceRepository,
    private readonly subscriptionRepo: SubscriptionRepository,
  ) {}

  async execute(input: EditArtifactInput): Promise<GenerationRequest> {
    const request = await this.generationRequestRepo.findById(input.generationRequestId)
    if (!request) throw new Error('Generation request not found')
    if (!request.outputs) throw new Error('Generation request has no outputs yet')

    const artifact = request.outputs.artifacts.find((a) => a.position === input.position)
    if (!artifact) throw new Error(`Artifact at position ${input.position} not found`)

    const brandProfile = await this.brandProfileRepo.findLatestByBrand(request.userId, request.brandId)

    // Subscription deveria sempre existir aqui (toda marca passa por EnsureSubscriptionUseCase
    // na criação, em apps/api) — null é tratado como "ilimitado" por segurança contra falha,
    // mesma filosofia fail-open do mecanismo que isto substitui (_local-adr-policy-0NN).
    const subscription = await this.subscriptionRepo.findByUserId(request.userId)
    const monthlyCreditsIncluded = subscription ? resolveEffectivePlanLimits(subscription).monthlyCreditsIncluded : null
    const now = new Date()
    const creditBalance = await this.creditBalanceRepo.findByUserId(request.userId)
    const creditState = resolveEffectiveCreditState(creditBalance, monthlyCreditsIncluded, now)

    if (!hasCreditsAvailable(creditState.totalAvailable)) {
      artifact.status = 'failed'
      artifact.error = NO_CREDITS_AVAILABLE_MESSAGE
      await this.generationRequestRepo.updateOutputs(request.id, request.outputs)
      return request
    }

    const brandTokens = brandProfile
      ? {
          primaryColor: brandProfile.visual.primaryColor,
          secondaryColor: brandProfile.visual.secondaryColor,
          typography: brandProfile.visual.typography,
        }
      : null
    const logoImage = brandProfile?.visual.logoStoragePath
      ? await this.imageStorage.download(brandProfile.visual.logoStoragePath)
      : null

    artifact.status = 'generating'
    artifact.error = null
    await this.generationRequestRepo.updateOutputs(request.id, request.outputs)

    try {
      const headline = request.outputs.headlines?.[artifact.position - 1] ?? ''
      const visualBrief = request.outputs.visualBriefs?.[artifact.position - 1] ?? request.inputs.description
      const bodyText = request.outputs.bodyTexts?.[artifact.position - 1] ?? ''
      const hasBodyOverlay = request.inputs.includeBodyText && bodyText.trim().length > 0
      const image = await this.imageGenerator.generateImage({
        userId: request.userId,
        brandId: request.brandId,
        description: `${visualBrief}. Ajuste solicitado pelo usuário: ${input.instruction}`,
        brandTokens,
        position: artifact.position,
        totalArtifacts: request.outputs.artifacts.length,
        aspectRatio: request.inputs.aspectRatio,
        templateStyle: request.inputs.style,
        hasTextOverlay: request.inputs.style !== TemplateStyle.NO_TEXT && headline.trim().length > 0,
        hasBodyOverlay,
      })
      const backgroundImageStoragePath = await this.imageStorage.upload(
        request.userId,
        request.brandId,
        Buffer.from(image.base64, 'base64'),
        image.mimeType,
        `${request.id}-bg`,
      )
      const finalImage = await this.templateRenderer.render({
        backgroundImage: image,
        headline,
        body: hasBodyOverlay ? bodyText : null,
        style: request.inputs.style,
        brandTokens,
        logoImage,
      })
      const path = await this.imageStorage.upload(
        request.userId,
        request.brandId,
        Buffer.from(finalImage.base64, 'base64'),
        finalImage.mimeType,
        request.id,
      )
      artifact.status = 'ready'
      artifact.imageStoragePath = path
      artifact.backgroundImageStoragePath = backgroundImageStoragePath
      // Editar sempre chama generateImage exatamente 1 vez — cobra 1 crédito só quando a edição
      // de fato produziu uma imagem nova (não cobra nada se o try acima falhar). atomicUpdate,
      // não save: o saldo lido antes da chamada de IA pode estar velho quando chega aqui
      // (_local-adr-policy-044, mesmo raciocínio de GenerateContentUseCase).
      if (monthlyCreditsIncluded !== null) {
        await this.creditBalanceRepo.atomicUpdate(request.userId, (current) =>
          applyCreditConsumption(current, request.userId, monthlyCreditsIncluded, 1, new Date()),
        )
      }
    } catch (err) {
      artifact.status = 'failed'
      artifact.error = err instanceof Error ? err.message : String(err)
    }

    await this.generationRequestRepo.updateOutputs(request.id, request.outputs)
    return request
  }
}
