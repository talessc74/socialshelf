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
    return input.accountType === 'personal' ? this.buildPersonalPrompt(input) : this.buildProfessionalPrompt(input)
  }

  // Conta pessoal (_local-bdr-policy-009): quem publica é a própria pessoa. Primeira pessoa,
  // sem CTA e sem citar o dono em terceira pessoa (o bug "a Fulana conseguiu chegar no destino"
  // vinha de aplicar a instrução profissional "cite a marca pelo nome" a uma conta pessoal cujo
  // "nome de marca" é o nome da pessoa). Sem seção de negócio/CTA — são só as fotos e o relato.
  private buildPersonalPrompt(input: CampaignCaptionWriterInput): string {
    return `Você escreve a legenda de um post PESSOAL de rede social a partir da foto anexada.

Esta é uma conta pessoal: quem publica é a própria pessoa, sobre a própria vida. Escreva em PRIMEIRA PESSOA, como quem viveu o momento ("cheguei", "consegui", "foi incrível"). NUNCA escreva em terceira pessoa e NUNCA se refira ao dono da conta pelo nome como se fosse uma empresa (nada de "a Fulana conseguiu...", "o Beltrano visitou..."). Não há venda nenhuma: sem CTA, sem "conheça", sem "agende", sem "venha", sem chamada comercial. São só as fotos e o relato genuíno do momento.

Campanha: "${input.campaignName}"${input.campaignDescription ? ` — ${input.campaignDescription}` : ''}
${this.keywordsSection(input)}
${this.voiceSection(input)}
${this.photoMetadataSection(input)}

Olhe a foto anexada e escreva uma legenda curta e natural que reflita o que está de fato nela e o momento vivido — não uma descrição genérica ("uma bela imagem de..."). Sem parecer gerada por IA, sem hashtags soltas sem contexto.

Responda apenas com um JSON no formato:
{"caption": "..."}`
  }

  // Conta profissional: comportamento validado como bom pelo usuário — cita a marca pelo nome e
  // pode usar CTA. Só acrescenta os metadados da foto (data/local/quantidade) ao prompt anterior.
  private buildProfessionalPrompt(input: CampaignCaptionWriterInput): string {
    const businessSection = input.brandBusiness
      ? `\nMarca: "${input.brandBusiness.name}"${
          input.brandBusiness.description ? `, ${input.brandBusiness.description}` : ''
        }. Use o nome da marca, nunca o segmento de mercado, ao citá-la no texto.`
      : ''

    return `Você escreve a legenda de um post de rede social a partir da foto anexada.

Campanha: "${input.campaignName}"${input.campaignDescription ? ` — ${input.campaignDescription}` : ''}
${this.keywordsSection(input)}
${businessSection}
${this.voiceSection(input)}
${this.photoMetadataSection(input)}

Olhe a foto anexada e escreva uma legenda que reflita o que está de fato nela — o que aparece, a cena, o momento — conectando com o tema da campanha acima. Não descreva a foto de forma genérica ("uma bela imagem de..."); escreva como o dono da marca escreveria de fato sobre aquele momento específico. Uma legenda curta e natural, sem parecer gerada por IA, sem hashtags soltas sem contexto.

Responda apenas com um JSON no formato:
{"caption": "..."}`
  }

  private keywordsSection(input: CampaignCaptionWriterInput): string {
    return input.keywords.length > 0
      ? `\nPalavras-chave da campanha (use como inspiração, não como hashtag forçada): ${input.keywords.join(', ')}.`
      : ''
  }

  private voiceSection(input: CampaignCaptionWriterInput): string {
    if (!input.brandVoice) return ''
    return `\nVoz da marca — escreva seguindo estritamente este tom: ${input.brandVoice.tone}.${
      input.brandVoice.allowedVocabulary.length > 0
        ? ` Prefira este vocabulário quando fizer sentido: ${input.brandVoice.allowedVocabulary.join(', ')}.`
        : ''
    }${
      input.brandVoice.prohibitedVocabulary.length > 0
        ? ` Nunca use estas palavras ou expressões: ${input.brandVoice.prohibitedVocabulary.join(', ')}.`
        : ''
    }`
  }

  // Informações reais que a foto carrega (EXIF), pra legenda refletir o momento verdadeiro em vez
  // de um texto genérico. A data é o sinal confiável; do GPS só usamos a existência do registro
  // (nunca alucinar o nome de um lugar que não foi informado — fator factual, GHOST).
  private photoMetadataSection(input: CampaignCaptionWriterInput): string {
    const lines: string[] = []
    if (input.photoTakenAt) lines.push(`- esta foto foi registrada em ${formatPtBrDate(input.photoTakenAt)}`)
    if (input.photoHasLocation) {
      lines.push(
        '- a foto carrega registro de local (GPS): escreva como quem esteve lá de verdade, mas NÃO invente o nome de cidade, ponto turístico ou estabelecimento se ele não foi informado',
      )
    }
    if (input.photoCount > 1) {
      lines.push(
        `- este post é um carrossel com ${input.photoCount} fotos do mesmo momento: a legenda deve valer para o conjunto, não descrever apenas a foto de capa`,
      )
    }
    return lines.length > 0 ? `\nInformações reais desta foto (use com naturalidade, não liste no texto):\n${lines.join('\n')}` : ''
  }
}

const PT_BR_MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// Formata em pt-BR de forma determinística (sem depender de locale/timezone do runtime, que
// poderia deslocar o dia) — a legenda só precisa do dia/mês/ano do registro.
function formatPtBrDate(date: Date): string {
  return `${date.getUTCDate()} de ${PT_BR_MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`
}
