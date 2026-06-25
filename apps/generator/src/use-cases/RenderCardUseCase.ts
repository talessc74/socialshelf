import type { TemplateStyle } from '@socialshelf/domain'
import type { TemplateRendererPort, ImageStoragePort, BrandProfileRepository } from '@socialshelf/domain'

export interface RenderCardInput {
  userId: string
  brandId: string
  imageStoragePath: string
  headline: string
  body: string | null
  style: TemplateStyle
}

export interface RenderCardResult {
  imageStoragePath: string
}

export class RenderCardUseCase {
  constructor(
    private readonly templateRenderer: TemplateRendererPort,
    private readonly imageStorage: ImageStoragePort,
    private readonly brandProfileRepo: BrandProfileRepository,
  ) {}

  async execute(input: RenderCardInput): Promise<RenderCardResult> {
    const brandProfile = await this.brandProfileRepo.findLatestByBrand(input.userId, input.brandId)
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

    const backgroundImage = await this.imageStorage.download(input.imageStoragePath)

    const rendered = await this.templateRenderer.render({
      backgroundImage,
      headline: input.headline,
      body: input.body,
      style: input.style,
      brandTokens,
      logoImage,
    })

    const imageStoragePath = await this.imageStorage.upload(
      input.userId,
      input.brandId,
      Buffer.from(rendered.base64, 'base64'),
      rendered.mimeType,
      'card',
    )

    return { imageStoragePath }
  }
}
