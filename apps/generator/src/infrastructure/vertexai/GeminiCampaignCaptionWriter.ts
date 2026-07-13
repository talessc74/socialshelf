import { VertexAI } from '@google-cloud/vertexai'
import type {
  CampaignCaptionWriterPort,
  CampaignCaptionWriterInput,
  CampaignCaptionWriterResult,
} from '@socialshelf/domain'

// Único ponto do projeto que manda a imagem em si (não só texto) pro Gemini pra escrever
// legenda — os demais writers de copy (GeminiCopyGenerator) só recebem descrição textual.
// Uma legenda por item de campanha, olhando a foto de capa daquele item específico, em vez
// de reaproveitar o mesmo texto genérico da campanha inteira em todo post (comportamento
// anterior, _local-edr-policy-039).
export class GeminiCampaignCaptionWriter implements CampaignCaptionWriterPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async write(input: CampaignCaptionWriterInput): Promise<CampaignCaptionWriterResult> {
    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: this.buildPrompt(input) },
            { inlineData: { mimeType: input.coverImage.mimeType, data: input.coverImage.base64 } },
          ],
        },
      ],
    })

    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for campaign caption')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for campaign caption')
    }

    const obj = parsed as Record<string, unknown>
    if (typeof obj['caption'] !== 'string' || obj['caption'].trim().length === 0) {
      throw new Error('Gemini returned a malformed campaign caption payload')
    }

    return { caption: obj['caption'] }
  }

  private buildPrompt(input: CampaignCaptionWriterInput): string {
    const businessSection = input.brandBusiness
      ? `\nMarca: "${input.brandBusiness.name}"${
          input.brandBusiness.description ? `, ${input.brandBusiness.description}` : ''
        }. Use o nome da marca, nunca o segmento de mercado, ao citá-la no texto.`
      : ''

    const voiceSection = input.brandVoice
      ? `\nVoz da marca — escreva seguindo estritamente este tom: ${input.brandVoice.tone}.${
          input.brandVoice.allowedVocabulary.length > 0
            ? ` Prefira este vocabulário quando fizer sentido: ${input.brandVoice.allowedVocabulary.join(', ')}.`
            : ''
        }${
          input.brandVoice.prohibitedVocabulary.length > 0
            ? ` Nunca use estas palavras ou expressões: ${input.brandVoice.prohibitedVocabulary.join(', ')}.`
            : ''
        }`
      : ''

    const keywordsSection =
      input.keywords.length > 0 ? `\nPalavras-chave da campanha (use como inspiração, não como hashtag forçada): ${input.keywords.join(', ')}.` : ''

    return `Você escreve a legenda de um post de rede social a partir da foto anexada.

Campanha: "${input.campaignName}"${input.campaignDescription ? ` — ${input.campaignDescription}` : ''}
${keywordsSection}
${businessSection}
${voiceSection}

Olhe a foto anexada e escreva uma legenda que reflita o que está de fato nela — o que aparece, a cena, o momento — conectando com o tema da campanha acima. Não descreva a foto de forma genérica ("uma bela imagem de..."); escreva como o dono da marca escreveria de fato sobre aquele momento específico. Uma legenda curta e natural, sem parecer gerada por IA, sem hashtags soltas sem contexto.

Responda apenas com um JSON no formato:
{"caption": "..."}`
  }
}
