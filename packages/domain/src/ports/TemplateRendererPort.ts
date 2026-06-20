import type { BrandTokens } from './ImageGeneratorPort.js'
import type { TemplateStyle } from '../entities/TemplateStyle.js'

export interface TemplateRenderInput {
  backgroundImage: { base64: string; mimeType: string }
  headline: string
  style: TemplateStyle
  brandTokens: BrandTokens | null
  logoImage: { base64: string; mimeType: string } | null
}

export interface RenderedTemplateImage {
  base64: string
  mimeType: string
}

export interface TemplateRendererPort {
  render(input: TemplateRenderInput): Promise<RenderedTemplateImage>
}
