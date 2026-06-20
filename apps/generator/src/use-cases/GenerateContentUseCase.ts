import { randomUUID } from 'node:crypto'
import type {
  CopyGeneratorPort,
  ImageGeneratorPort,
  ImageStoragePort,
  TemplateRendererPort,
  GenerationRequestRepository,
  PostRepository,
  BrandProfileRepository,
  TopicSuggestionRepository,
  GenerationRequest,
  GenerationArtifact,
  Platform,
  PlatformContent,
  TemplateStyle,
  AspectRatio,
} from '@socialshelf/domain'

export interface GenerateContentInput {
  userId: string
  brandId: string
  description: string
  textContent: string | null
  imageStoragePaths: string[]
  targetPlatforms: Platform[]
  artifactCount: number
  topicSuggestionId: string | null
  style: TemplateStyle
  aspectRatio: AspectRatio
}

export class GenerateContentUseCase {
  constructor(
    private readonly copyGenerator: CopyGeneratorPort,
    private readonly imageGenerator: ImageGeneratorPort,
    private readonly templateRenderer: TemplateRendererPort,
    private readonly imageStorage: ImageStoragePort,
    private readonly generationRequestRepo: GenerationRequestRepository,
    private readonly postRepo: PostRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
    private readonly topicSuggestionRepo: TopicSuggestionRepository,
  ) {}

  async execute(input: GenerateContentInput): Promise<GenerationRequest> {
    const now = new Date()
    let request: GenerationRequest = {
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      status: 'pending',
      inputs: {
        description: input.description,
        textContent: input.textContent,
        imageStoragePaths: input.imageStoragePaths,
        targetPlatforms: input.targetPlatforms,
        artifactCount: input.artifactCount,
        topicSuggestionId: input.topicSuggestionId,
        aspectRatio: input.aspectRatio,
        style: input.style,
      },
      outputs: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }
    await this.generationRequestRepo.save(request)

    const brandProfile = await this.brandProfileRepo.findLatestByBrand(input.brandId)
    const pautaContext = await this.resolvePautaContext(input.brandId, input.topicSuggestionId)

    request.status = 'generating_copy'
    await this.generationRequestRepo.updateStatus(request.id, 'generating_copy')

    let copyResult
    try {
      copyResult = await this.copyGenerator.generateCopy({
        description: input.description,
        ...(input.textContent !== null && { textContent: input.textContent }),
        images: [],
        targetPlatforms: input.targetPlatforms,
        format: input.artifactCount > 1 ? 'carousel' : 'single',
        artifactCount: input.artifactCount,
        pautaContext,
        brandVoice: brandProfile?.voice ?? null,
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await this.generationRequestRepo.updateStatus(request.id, 'failed', error)
      return { ...request, status: 'failed', error }
    }

    const artifacts: GenerationArtifact[] = Array.from({ length: input.artifactCount }, (_, i) => ({
      position: i + 1,
      status: 'pending',
      imageStoragePath: null,
      error: null,
    }))

    request = {
      ...request,
      status: 'generating_image',
      outputs: { copies: copyResult.copies, cta: copyResult.cta, headlines: copyResult.headlines, artifacts },
    }
    await this.generationRequestRepo.updateOutputs(request.id, request.outputs!)
    await this.generationRequestRepo.updateStatus(request.id, 'generating_image')

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

    for (const artifact of artifacts) {
      artifact.status = 'generating'
    }
    await this.generationRequestRepo.updateOutputs(request.id, request.outputs!)

    await Promise.all(
      artifacts.map(async (artifact) => {
        try {
          const uploadedPath = input.imageStoragePaths[artifact.position - 1]
          const image = uploadedPath
            ? await this.imageStorage.download(uploadedPath)
            : await this.imageGenerator.generateImage({
                description: input.description,
                brandTokens,
                position: artifact.position,
                totalArtifacts: input.artifactCount,
                aspectRatio: input.aspectRatio,
              })
          const finalImage = await this.templateRenderer.render({
            backgroundImage: image,
            headline: copyResult.headlines[artifact.position - 1]!,
            style: input.style,
            brandTokens,
            logoImage,
          })
          const path = await this.imageStorage.upload(
            input.userId,
            input.brandId,
            Buffer.from(finalImage.base64, 'base64'),
            finalImage.mimeType,
            request.id,
          )
          artifact.status = 'ready'
          artifact.imageStoragePath = path
        } catch (err) {
          artifact.status = 'failed'
          artifact.error = err instanceof Error ? err.message : String(err)
        }
        await this.generationRequestRepo.updateOutputs(request.id, request.outputs!)
      }),
    )

    const readyArtifacts = artifacts.filter((a) => a.status === 'ready')
    if (readyArtifacts.length === 0) {
      const error = 'All artifacts failed to generate'
      request = { ...request, status: 'failed', error }
      await this.generationRequestRepo.updateStatus(request.id, 'failed', error)
      return request
    }

    request = { ...request, status: 'ready' }
    await this.generationRequestRepo.updateStatus(request.id, 'ready')

    const content: PlatformContent[] = Object.entries(copyResult.copies).map(([platform, copy]) => ({
      platform: platform as Platform,
      text: copy!.text,
      charCount: copy!.charCount,
    }))

    await this.postRepo.save({
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      brandProfileVersion: brandProfile?.version ?? null,
      content,
      imageStoragePaths: readyArtifacts.map((a) => a.imageStoragePath!),
      status: 'ai-draft',
      scheduledAt: null,
      publishedAt: null,
      externalIds: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    return request
  }

  private async resolvePautaContext(
    brandId: string,
    topicSuggestionId: string | null,
  ): Promise<{ headline: string; rationale: string } | null> {
    if (!topicSuggestionId) return null
    const suggestion = await this.topicSuggestionRepo.findById(brandId, topicSuggestionId)
    if (!suggestion) return null
    return { headline: suggestion.headline, rationale: suggestion.rationale }
  }
}
