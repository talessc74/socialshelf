import type { AspectRatio } from '../entities/AspectRatio.js'
import type { TemplateStyle } from '../entities/TemplateStyle.js'

export interface BrandTokens {
  primaryColor: string
  secondaryColor: string
  typography: string
}

export interface ImagePrompt {
  description: string
  style?: string
  brandTokens: BrandTokens | null
  position: number
  totalArtifacts: number
  aspectRatio: AspectRatio
  templateStyle: TemplateStyle
  /**
   * Se um headline vetorial será desenhado sobre esta imagem depois (por
   * SharpTemplateRenderer). Quando true, a composição deve reservar uma zona "calma"
   * (conforme templateStyle) para a barra de texto; quando false, a imagem é o post final
   * e não deve reservar zona alguma.
   */
  hasTextOverlay: boolean
}

export interface GeneratedImage {
  base64: string
  mimeType: string
}

export interface ImageGeneratorPort {
  generateImage(prompt: ImagePrompt): Promise<GeneratedImage>
}
