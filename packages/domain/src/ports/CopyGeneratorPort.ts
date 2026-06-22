import type { Platform } from '../entities/Platform.js'
import type { PlatformCopy } from '../entities/GenerationRequest.js'
import type { BrandProfileVoice } from '../entities/BrandProfile.js'

export interface PautaContext {
  headline: string
  rationale: string
}

/**
 * Quantos artefatos (cards/slides) o post deve ter:
 * - `fixed`: o usuário subiu fotos próprias — a quantidade enviada trava a quantidade
 *   exata de cards; o gerador de copy deve produzir exatamente `count` headlines/briefs.
 * - `free`: nenhuma foto própria — o conteúdo é o indutor da estrutura. O gerador de
 *   copy decide livremente quantos cards o texto pede (1 a `maxCount`), e essa decisão
 *   se torna a quantidade real de artefatos do post.
 */
export type ArtifactPlan = { mode: 'fixed'; count: number } | { mode: 'free'; maxCount: number }

export interface ContentInputs {
  description: string
  textContent?: string
  images: Array<{ base64: string; mimeType: string }>
  targetPlatforms: Platform[]
  artifactPlan: ArtifactPlan
  pautaContext: PautaContext | null
  brandVoice: BrandProfileVoice | null
}

export type PlatformCopies = Partial<Record<Platform, PlatformCopy>>

export interface CopyGenerationResult {
  copies: PlatformCopies
  cta: string
  /**
   * Um headline curto (~80 caracteres) por artefato, na ordem dos slides. Em modo `fixed`,
   * `length === artifactPlan.count`; em modo `free`, o próprio comprimento é a quantidade
   * de cards decidida pela IA (entre 1 e `artifactPlan.maxCount`). Em carrossel, formam uma
   * sequência narrativa (gancho → desenvolvimento → fechamento), não N variações do mesmo texto.
   */
  headlines: string[]
  /**
   * Uma cena/composição visual por artefato (mesmo `length` de `headlines`), derivada do
   * headline correspondente — usada para gerar a imagem de fundo. Evita que a imagem
   * nasça desconectada da mensagem (gerada só a partir da descrição crua do usuário).
   */
  visualBriefs: string[]
}

export interface CopyGeneratorPort {
  generateCopy(inputs: ContentInputs): Promise<CopyGenerationResult>
}
