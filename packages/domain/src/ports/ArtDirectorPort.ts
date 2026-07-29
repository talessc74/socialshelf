import type { Platform } from '../entities/Platform.js'
import type { TemplateStyle } from '../entities/TemplateStyle.js'
import type { AspectRatio } from '../entities/AspectRatio.js'
import type { BrandProfileVoice } from '../entities/BrandProfile.js'
import type { BrandTokens } from './ImageGeneratorPort.js'
import type { PautaContext } from './CopyGeneratorPort.js'

export interface ArtifactBrief {
  position: number
  headline: string
  visualBrief: string
}

export interface ArtDirectionInput {
  // Usados só para atribuir o custo estimado desta chamada à marca certa (AiUsageRecorderPort)
  // — não influenciam a direção de arte gerada.
  userId: string
  brandId: string
  description: string
  targetPlatforms: Platform[]
  /** Um item por artefato do post — `length === 1` é post único, `length > 1` é carrossel. */
  artifacts: ArtifactBrief[]
  style: TemplateStyle
  aspectRatio: AspectRatio
  brandVoice: BrandProfileVoice | null
  brandTokens: BrandTokens | null
  pautaContext: PautaContext | null
}

export interface ArtifactDirection {
  position: number
  /** Instrução de imagem (em inglês) que substitui o visualBrief cru ao chamar o ImageGeneratorPort. */
  imagePrompt: string
  /** Elementos visuais (em inglês) a evitar nesta cena — complementa, nunca substitui, o negativePrompt técnico do ImageGeneratorPort. */
  negativePrompt: string
}

export interface ArtDirectionResult {
  artifacts: ArtifactDirection[]
}

/**
 * Especialista responsável por traduzir o conteúdo de um post (headlines + visualBriefs,
 * já decididos pelo CopyGeneratorPort) em instruções de imagem com direção de arte real:
 * identidade visual consistente entre artefatos do mesmo carrossel, integração com a marca,
 * e composição que já antecipa a barra de texto sobreposta depois pelo TemplateRendererPort.
 */
export interface ArtDirectorPort {
  direct(input: ArtDirectionInput): Promise<ArtDirectionResult>
}
