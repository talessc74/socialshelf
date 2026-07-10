import { TemplateStyle, AspectRatio } from '@socialshelf/domain'
import type { Platform } from '@socialshelf/domain'
import { fetchInternal } from '../../lib/serviceAuth.js'

export interface AutonomyTopicSuggestion {
  id: string
  headline: string
  summary: string
  rationale: string
}

export interface AutonomyClassification {
  blocked: boolean
  autoPublishEligible: boolean
}

// Fronteira de infraestrutura do tick de autonomia com o generator-service — não é uma porta
// de domínio porque é específica de como os serviços deste deploy conversam entre si (mesmo
// espírito de resolveImageUrl/resolveTikTokVideoUrl em publish.routes.ts), não um conceito de
// negócio reaproveitável fora daqui.
export interface GeneratorAutonomyClient {
  suggestTopics(brandId: string): Promise<AutonomyTopicSuggestion[]>
  classifyAutonomy(input: {
    topic: { headline: string; summary: string; rationale: string }
    autoPublishTopics: string[]
    blockedTopics: string[]
  }): Promise<AutonomyClassification>
  // Reaproveita o mesmo /generate usado pelo fluxo manual — sem foto própria (o pipeline
  // automático não tem de onde tirar uma), então a IA gera a imagem, igual ao caso "sem
  // fotos" já suportado hoje.
  generate(input: { brandId: string; description: string; targetPlatforms: Platform[]; topicSuggestionId: string }): Promise<{
    status: string
  }>
}

export class HttpGeneratorAutonomyClient implements GeneratorAutonomyClient {
  constructor(
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
  ) {}

  async suggestTopics(brandId: string): Promise<AutonomyTopicSuggestion[]> {
    const res = await fetchInternal(`${this.generatorUrl}/pauta/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
      body: JSON.stringify({ brandId }),
    })
    if (!res.ok) throw new Error(`Failed to suggest topics: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { suggestions: AutonomyTopicSuggestion[] }
    return data.suggestions
  }

  async classifyAutonomy(input: {
    topic: { headline: string; summary: string; rationale: string }
    autoPublishTopics: string[]
    blockedTopics: string[]
  }): Promise<AutonomyClassification> {
    const res = await fetchInternal(`${this.generatorUrl}/pauta/classify-autonomy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Failed to classify topic autonomy: ${res.status} ${await res.text()}`)
    return (await res.json()) as AutonomyClassification
  }

  async generate(input: {
    brandId: string
    description: string
    targetPlatforms: Platform[]
    topicSuggestionId: string
  }): Promise<{ status: string }> {
    const res = await fetchInternal(`${this.generatorUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
      body: JSON.stringify({
        brandId: input.brandId,
        description: input.description,
        targetPlatforms: input.targetPlatforms,
        topicSuggestionId: input.topicSuggestionId,
        style: TemplateStyle.BOLD_BOTTOM,
        aspectRatio: AspectRatio.SQUARE,
        includeBodyText: false,
      }),
    })
    if (!res.ok) throw new Error(`Failed to generate content: ${res.status} ${await res.text()}`)
    const data = (await res.json()) as { generationRequest: { status: string } }
    return { status: data.generationRequest.status }
  }
}
