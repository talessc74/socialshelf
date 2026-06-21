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

    return this.toCopyGenerationResult(parsed, inputs.artifactCount)
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

    const headlinesSection =
      inputs.artifactCount > 1
        ? `Gere exatamente ${inputs.artifactCount} headlines curtos (até 80 caracteres cada), um por slide, na ordem em que aparecem no carrossel. Eles devem contar uma história coesa, não ser variações do mesmo texto: o primeiro é o gancho/problema que prende a atenção, os do meio desenvolvem a ideia passo a passo, e o último fecha com a conclusão ou reforça o CTA. Cada headline será desenhado como texto sobre a imagem daquele slide.`
        : `Gere também um headline curto (até 80 caracteres), para ser desenhado como texto sobre a imagem de fundo — distinto da legenda completa de cada plataforma.`

    const visualBriefsSection = `Para cada headline, gere também uma "visualBrief": uma descrição de cena (1-2 frases, em inglês, para um gerador de imagens) que ilustre visualmente a ideia daquele headline especificamente — não a descrição genérica do post. Ex.: se o headline fala de "perder tempo com burocracia", a cena pode ser "a tired person buried in stacks of paperwork at a cluttered desk", não uma foto genérica de escritório. Nunca peça para incluir texto, palavras ou números na cena.`

    return `Gere texto de post para redes sociais a partir da descrição abaixo.

Descrição: ${inputs.description}
${inputs.textContent ? `Texto de referência fornecido pelo usuário: ${inputs.textContent}` : ''}
${pautaSection}
${voiceSection}
${formatSection}

Limites de caracteres por plataforma:
${platformLimits}

${headlinesSection}

${visualBriefsSection}

Responda apenas com um JSON no formato:
{"copies": {"<platform>": {"text": "...", "charCount": 0}}, "cta": "...", "headlines": ["...", "..."], "visualBriefs": ["...", "..."]}
Os arrays "headlines" e "visualBriefs" devem ter exatamente ${inputs.artifactCount} ${inputs.artifactCount > 1 ? 'itens cada' : 'item cada'}, na mesma ordem.`
  }

  private toCopyGenerationResult(parsed: unknown, expectedHeadlineCount: number): CopyGenerationResult {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Gemini returned malformed copy generation payload')
    }
    const obj = parsed as Record<string, unknown>
    const copies = obj['copies']
    const cta = obj['cta']
    const headlines = obj['headlines']
    const visualBriefs = obj['visualBriefs']
    if (
      typeof copies !== 'object' ||
      copies === null ||
      typeof cta !== 'string' ||
      !Array.isArray(headlines) ||
      headlines.length !== expectedHeadlineCount ||
      !headlines.every((h) => typeof h === 'string') ||
      !Array.isArray(visualBriefs) ||
      visualBriefs.length !== expectedHeadlineCount ||
      !visualBriefs.every((v) => typeof v === 'string')
    ) {
      throw new Error('Gemini returned malformed copy generation payload')
    }
    return {
      copies: copies as CopyGenerationResult['copies'],
      cta,
      headlines: headlines as string[],
      visualBriefs: visualBriefs as string[],
    }
  }
}
