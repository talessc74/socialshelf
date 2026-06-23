import type { BrandTokens } from './ImageGeneratorPort.js'
import type { TemplateStyle } from '../entities/TemplateStyle.js'

export interface TemplateRenderInput {
  backgroundImage: { base64: string; mimeType: string }
  headline: string
  /** Parágrafo de apoio desenhado abaixo do headline, menor e com peso regular. `null` quando o toggle de texto de apoio está desativado. */
  body: string | null
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
