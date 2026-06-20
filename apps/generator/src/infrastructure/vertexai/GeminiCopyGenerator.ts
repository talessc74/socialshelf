import { VertexAI } from '@google-cloud/vertexai'
import type { CopyGeneratorPort, ContentInputs, CopyGenerationResult } from '@socialshelf/domain'
import { PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'

export class GeminiCopyGenerator implements CopyGeneratorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async generateCopy(inputs: ContentInputs): Promise<CopyGenerationResult> {
    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = this.buildPrompt(inputs)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for copy generation')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for copy generation')
    }

    return this.toCopyGenerationResult(parsed)
  }

  private buildPrompt(inputs: ContentInputs): string {
    const platformLimits = inputs.targetPlatforms
      .map((platform) => `- ${platform}: máximo ${PLATFORM_CHARACTER_LIMITS[platform]} caracteres`)
      .join('\n')

    const pautaSection = inputs.pautaContext
      ? `\nPauta de referência (notícia verificada): "${inputs.pautaContext.headline}". Relevância: ${inputs.pautaContext.rationale}`
      : ''

    const voiceSection = inputs.brandVoice
      ? `\nVoz da marca — escreva seguindo estritamente este tom: ${inputs.brandVoice.tone}.${
          inputs.brandVoice.allowedVocabulary.length > 0
            ? ` Prefira este vocabulário quando fizer sentido: ${inputs.brandVoice.allowedVocabulary.join(', ')}.`
            : ''
        }${
          inputs.brandVoice.prohibitedVocabulary.length > 0
            ? ` Nunca use estas palavras ou expressões: ${inputs.brandVoice.prohibitedVocabulary.join(', ')}.`
            : ''
        }`
      : ''

    const formatSection =
      inputs.format === 'carousel'
        ? 'Formato: carrossel com múltiplos slides. O CTA deve incentivar a navegação entre os slides (ex: "arraste para ver mais").'
        : 'Formato: post único. O CTA deve incentivar engajamento direto (ex: comentário, compartilhamento).'

    return `Gere texto de post para redes sociais a partir da descrição abaixo.

Descrição: ${inputs.description}
${inputs.textContent ? `Texto de referência fornecido pelo usuário: ${inputs.textContent}` : ''}
${pautaSection}
${voiceSection}
${formatSection}

Limites de caracteres por plataforma:
${platformLimits}

Gere também um headline curto (até 80 caracteres), compartilhado entre as plataformas, para ser desenhado como texto sobre a imagem de fundo — distinto da legenda completa de cada plataforma.

Responda apenas com um JSON no formato:
{"copies": {"<platform>": {"text": "...", "charCount": 0}}, "cta": "...", "headline": "..."}`
  }

  private toCopyGenerationResult(parsed: unknown): CopyGenerationResult {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Gemini returned malformed copy generation payload')
    }
    const obj = parsed as Record<string, unknown>
    const copies = obj['copies']
    const cta = obj['cta']
    const headline = obj['headline']
    if (
      typeof copies !== 'object' ||
      copies === null ||
      typeof cta !== 'string' ||
      typeof headline !== 'string'
    ) {
      throw new Error('Gemini returned malformed copy generation payload')
    }
    return { copies: copies as CopyGenerationResult['copies'], cta, headline }
  }
}
