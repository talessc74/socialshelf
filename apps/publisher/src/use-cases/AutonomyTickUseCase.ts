import { Platform } from '@socialshelf/domain'
import type {
  AutonomyBrandDiscoveryPort,
  AutonomyEligibleBrand,
  AutonomyDailyCounterRepository,
  OAuthRepository,
  PostRepository,
} from '@socialshelf/domain'
import type { PublishPostUseCase } from './PublishPostUseCase.js'
import type { GeneratorAutonomyClient } from '../infrastructure/generator/GeneratorAutonomyClient.js'

export type AutonomyTickAction =
  | 'skipped-no-platforms'
  | 'skipped-no-suggestions'
  | 'skipped-blocked'
  | 'skipped-not-eligible'
  | 'skipped-daily-limit'
  | 'draft-created'
  | 'published'
  | 'error'

export interface AutonomyTickBrandResult {
  userId: string
  brandId: string
  action: AutonomyTickAction
  topicHeadline?: string
  error?: string
}

// Fase 4 do roadmap (_local-bdr-plan-002): ativa o dial de autonomia com os guardrails
// exigidos como pré-condição — teto diário configurável por marca (não um ajuste
// posterior), classificação semântica de bloqueio antes de qualquer rascunho, e modo
// automático restrito aos tópicos explicitamente liberados. "Manual" nunca chega aqui:
// findEligibleBrands() já filtra por autonomyLevel — trocar o dial de volta para manual
// entre um tick e o próximo já corta a automação, sem precisar de um botão de emergência
// separado.
export class AutonomyTickUseCase {
  constructor(
    private readonly brandDiscovery: AutonomyBrandDiscoveryPort,
    private readonly dailyCounter: AutonomyDailyCounterRepository,
    private readonly oauthRepo: OAuthRepository,
    private readonly postRepo: PostRepository,
    private readonly publishPostUseCase: PublishPostUseCase,
    private readonly generatorClient: GeneratorAutonomyClient,
  ) {}

  async execute(): Promise<AutonomyTickBrandResult[]> {
    const brands = await this.brandDiscovery.findEligibleBrands()
    const results: AutonomyTickBrandResult[] = []
    for (const brand of brands) {
      try {
        results.push(await this.processBrand(brand))
      } catch (err) {
        results.push({
          userId: brand.userId,
          brandId: brand.brandId,
          action: 'error',
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return results
  }

  private async processBrand(brand: AutonomyEligibleBrand): Promise<AutonomyTickBrandResult> {
    const base = { userId: brand.userId, brandId: brand.brandId }

    // TikTok fica fora do alvo automático: exige vídeo, e este pipeline só compõe post de
    // imagem/texto — mesma exclusão já aplicada em "publicar também em" na tela de resultado.
    const connections = await this.oauthRepo.findByBrand(brand.userId, brand.brandId)
    const targetPlatforms = [...new Set(connections.map((c) => c.platform))].filter((p) => p !== Platform.TIKTOK)
    if (targetPlatforms.length === 0) return { ...base, action: 'skipped-no-platforms' }

    const suggestions = await this.generatorClient.suggestTopics(brand.brandId)
    if (suggestions.length === 0) return { ...base, action: 'skipped-no-suggestions' }

    // Só a pauta de maior audienceFitScore (a primeira, já ordenada por SuggestTopicsUseCase)
    // — evita 1 chamada de IA por sugestão por marca por dia; se ela for bloqueada, a marca
    // simplesmente tenta de novo no próximo tick com uma lista atualizada de notícias.
    const topSuggestion = suggestions[0]!
    const classification = await this.generatorClient.classifyAutonomy({
      topic: {
        headline: topSuggestion.headline,
        summary: topSuggestion.summary,
        rationale: topSuggestion.rationale,
      },
      autoPublishTopics: brand.autoPublishTopics,
      blockedTopics: brand.blockedTopics,
    })
    if (classification.blocked) {
      return { ...base, action: 'skipped-blocked', topicHeadline: topSuggestion.headline }
    }

    const wantsAutoPublish = brand.autonomyLevel === 'automatic' && classification.autoPublishEligible
    if (brand.autonomyLevel === 'automatic' && !classification.autoPublishEligible) {
      // Automático age só dentro dos tópicos liberados — fora disso, nem rascunho é criado
      // automaticamente (o usuário não pediu geração automática para qualquer assunto).
      return { ...base, action: 'skipped-not-eligible', topicHeadline: topSuggestion.headline }
    }

    if (wantsAutoPublish) {
      const today = new Date().toISOString().slice(0, 10)
      const underLimit = await this.dailyCounter.incrementIfUnderLimit(
        brand.userId,
        brand.brandId,
        today,
        brand.maxAutoPostsPerDay,
      )
      if (!underLimit) return { ...base, action: 'skipped-daily-limit', topicHeadline: topSuggestion.headline }
    }

    const generateResult = await this.generatorClient.generate({
      brandId: brand.brandId,
      description: `${topSuggestion.headline}. ${topSuggestion.rationale}`,
      targetPlatforms,
      topicSuggestionId: topSuggestion.id,
    })
    if (generateResult.status !== 'ready') {
      return {
        ...base,
        action: 'error',
        error: `generation did not finish ready (status: ${generateResult.status})`,
        topicHeadline: topSuggestion.headline,
      }
    }

    // GenerateContentUseCase não devolve o id do Post que acabou de criar — reencontrado
    // aqui pelo rascunho mais recente da marca, já ordenado por createdAt desc.
    const drafts = await this.postRepo.findByBrand(brand.userId, brand.brandId, 'ai-draft')
    const newestDraft = drafts[0]
    if (!newestDraft) {
      return {
        ...base,
        action: 'error',
        error: 'generation succeeded but no ai-draft post was found',
        topicHeadline: topSuggestion.headline,
      }
    }

    if (!wantsAutoPublish) return { ...base, action: 'draft-created', topicHeadline: topSuggestion.headline }

    await this.publishPostUseCase.execute(newestDraft.id, brand.userId, brand.brandId)
    return { ...base, action: 'published', topicHeadline: topSuggestion.headline }
  }
}
