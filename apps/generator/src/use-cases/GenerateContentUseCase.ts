import { randomUUID } from 'node:crypto'
import { TemplateStyle, PLATFORM_CHARACTER_LIMITS, MAX_GENERATION_ARTIFACTS } from '@socialshelf/domain'
import type {
  CopyGeneratorPort,
  ArtDirectorPort,
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
  AspectRatio,
  ArtifactPlan,
} from '@socialshelf/domain'

export interface GenerateContentInput {
  userId: string
  brandId: string
  description: string
  textContent: string | null
  imageStoragePaths: string[]
  targetPlatforms: Platform[]
  topicSuggestionId: string | null
  style: TemplateStyle
  aspectRatio: AspectRatio
}

export class GenerateContentUseCase {
  constructor(
    private readonly copyGenerator: CopyGeneratorPort,
    private readonly artDirector: ArtDirectorPort,
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

    const artifactPlan: ArtifactPlan =
      input.imageStoragePaths.length > 0
        ? { mode: 'fixed', count: input.imageStoragePaths.length }
        : { mode: 'free', maxCount: MAX_GENERATION_ARTIFACTS }

    let copyResult
    try {
      copyResult = await this.copyGenerator.generateCopy({
        description: input.description,
        ...(input.textContent !== null && { textContent: input.textContent }),
        images: [],
        targetPlatforms: input.targetPlatforms,
        artifactPlan,
        pautaContext,
        brandVoice: brandProfile?.voice ?? null,
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await this.generationRequestRepo.updateStatus(request.id, 'failed', error)
      return { ...request, status: 'failed', error }
    }

    // Gemini sometimes ignores the character limits stated in the prompt, so clamp here
    // as a safety net to avoid rejecting the post downstream (CreatePostUseCase enforces the same limits).
    for (const [platform, copy] of Object.entries(copyResult.copies) as [Platform, { text: string; charCount: number }][]) {
      const limit = PLATFORM_CHARACTER_LIMITS[platform]
      if (copy.text.length > limit) {
        const truncated = truncateToLimit(copy.text, limit)
        copyResult.copies[platform] = { text: truncated, charCount: truncated.length }
      }
    }

    const artifacts: GenerationArtifact[] = copyResult.headlines.map((_, i) => ({
      position: i + 1,
      status: 'pending',
      imageStoragePath: null,
      error: null,
    }))

    request = {
      ...request,
      status: 'generating_image',
      outputs: {
        copies: copyResult.copies,
        cta: copyResult.cta,
        headlines: copyResult.headlines,
        visualBriefs: copyResult.visualBriefs,
        artifacts,
      },
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

    // Direção de arte só importa quando alguma imagem será gerada por IA — em modo `fixed`
    // (fotos próprias enviadas), todo artefato usa a foto do usuário e o ImageGeneratorPort
    // nunca é chamado, então pedi-la aqui seria uma chamada de IA desperdiçada.
    const imagePromptsByPosition = new Map<number, string>(
      artifacts.map((artifact) => [artifact.position, copyResult.visualBriefs[artifact.position - 1]!]),
    )
    const negativePromptsByPosition = new Map<number, string>()
    if (input.imageStoragePaths.length === 0) {
      try {
        const direction = await this.artDirector.direct({
          description: input.description,
          targetPlatforms: input.targetPlatforms,
          artifacts: artifacts.map((artifact) => ({
            position: artifact.position,
            headline: copyResult.headlines[artifact.position - 1]!,
            visualBrief: copyResult.visualBriefs[artifact.position - 1]!,
          })),
          style: input.style,
          aspectRatio: input.aspectRatio,
          brandVoice: brandProfile?.voice ?? null,
          brandTokens,
          pautaContext,
        })
        for (const artifactDirection of direction.artifacts) {
          imagePromptsByPosition.set(artifactDirection.position, artifactDirection.imagePrompt)
          if (artifactDirection.negativePrompt.trim().length > 0) {
            negativePromptsByPosition.set(artifactDirection.position, artifactDirection.negativePrompt)
          }
        }
      } catch {
        // Falha na direção de arte não deve travar a geração — seguimos com o visualBrief cru.
      }
    }

    for (const artifact of artifacts) {
      artifact.status = 'generating'
    }
    await this.generationRequestRepo.updateOutputs(request.id, request.outputs!)

    await Promise.all(
      artifacts.map(async (artifact) => {
        try {
          const headline = copyResult.headlines[artifact.position - 1]!
          const uploadedPath = input.imageStoragePaths[artifact.position - 1]
          const image = uploadedPath
            ? await this.imageStorage.download(uploadedPath)
            : await this.imageGenerator.generateImage({
                description: imagePromptsByPosition.get(artifact.position)!,
                ...(negativePromptsByPosition.has(artifact.position) && {
                  negativePrompt: negativePromptsByPosition.get(artifact.position)!,
                }),
                brandTokens,
                position: artifact.position,
                totalArtifacts: artifacts.length,
                aspectRatio: input.aspectRatio,
                templateStyle: input.style,
                hasTextOverlay: input.style !== TemplateStyle.NO_TEXT && headline.trim().length > 0,
              })
          const finalImage = await this.templateRenderer.render({
            backgroundImage: image,
            headline,
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

function truncateToLimit(text: string, limit: number): string {
  const ellipsis = '…'
  const truncated = text.slice(0, limit - ellipsis.length)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + ellipsis
}
