import type {
  TemplateRendererPort,
  ImageStoragePort,
  GenerationRequestRepository,
  BrandProfileRepository,
  GenerationRequest,
} from '@socialshelf/domain'

export interface EditArtifactTextInput {
  generationRequestId: string
  position: number
  headline: string
  body: string | null
}

export class EditArtifactTextUseCase {
  constructor(
    private readonly templateRenderer: TemplateRendererPort,
    private readonly imageStorage: ImageStoragePort,
    private readonly generationRequestRepo: GenerationRequestRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
  ) {}

  async execute(input: EditArtifactTextInput): Promise<GenerationRequest> {
    const request = await this.generationRequestRepo.findById(input.generationRequestId)
    if (!request) throw new Error('Generation request not found')
    if (!request.outputs) throw new Error('Generation request has no outputs yet')

    const artifact = request.outputs.artifacts.find((a) => a.position === input.position)
    if (!artifact) throw new Error(`Artifact at position ${input.position} not found`)
    if (!artifact.backgroundImageStoragePath) {
      throw new Error('This card does not support direct text editing')
    }

    const brandProfile = await this.brandProfileRepo.findLatestByBrand(request.userId, request.brandId)
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
      const backgroundImage = await this.imageStorage.download(artifact.backgroundImageStoragePath)
      const hasBodyOverlay = input.body !== null && input.body.trim().length > 0
      const finalImage = await this.templateRenderer.render({
        backgroundImage,
        headline: input.headline,
        body: hasBodyOverlay ? input.body : null,
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

      if (request.outputs.headlines) request.outputs.headlines[artifact.position - 1] = input.headline
      if (request.outputs.bodyTexts) request.outputs.bodyTexts[artifact.position - 1] = input.body ?? ''
    } catch (err) {
      artifact.status = 'failed'
      artifact.error = err instanceof Error ? err.message : String(err)
    }

    await this.generationRequestRepo.updateOutputs(request.id, request.outputs)
    return request
  }
}
