import { VertexAI } from '@google-cloud/vertexai'
import {
  TemplateStyle,
  TEMPLATE_STYLE_LABELS,
  type TopicAutonomyMatcherPort,
  type TopicAutonomyMatch,
} from '@socialshelf/domain'

type ClassifyInput = {
  topic: { headline: string; summary: string; rationale: string }
  autoPublishTopics: string[]
  blockedTopics: string[]
  stylePreferences: TemplateStyle[]
}

// Julga se uma pauta se encaixa nos temas que o usuário liberou/bloqueou para publicação
// autônoma (_local-bdr-plan-002, Fase 4) — correspondência semântica, não palavra-chave
// literal, pelo mesmo motivo de GeminiAudienceFitScorer: "Caso do Dia com resultado real do
// produto" deve reconhecer uma pauta sobre um case de cliente mesmo sem repetir esse texto.
// Também escolhe, dentro da ordem de preferência de estilo da marca, qual TemplateStyle
// combina melhor com o assunto e o tom daquela pauta específica — não é sempre o primeiro
// da lista.
export class GeminiTopicAutonomyMatcher implements TopicAutonomyMatcherPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async classify(input: ClassifyInput): Promise<TopicAutonomyMatch> {
    const fallbackStyle = input.stylePreferences[0] ?? TemplateStyle.BOLD_BOTTOM

    // Sem nenhum tópico liberado/bloqueado e sem nada a decidir sobre estilo (0 ou 1
    // preferência configurada), não há julgamento nenhum a fazer — evita uma chamada de IA
    // pra responder algo que já sabemos sem ela.
    if (input.autoPublishTopics.length === 0 && input.blockedTopics.length === 0 && input.stylePreferences.length <= 1) {
      return { blocked: false, autoPublishEligible: false, recommendedStyle: fallbackStyle }
    }

    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const result = await generativeModel.generateContent(this.buildPrompt(input))
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for topic autonomy classification')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for topic autonomy classification')
    }

    const obj = parsed as Record<string, unknown>
    if (typeof obj['blocked'] !== 'boolean' || typeof obj['autoPublishEligible'] !== 'boolean') {
      throw new Error('Gemini returned malformed topic autonomy classification payload')
    }

    // O modelo só deve escolher dentro do que foi oferecido — qualquer resposta fora de
    // `stylePreferences` (alucinação, string vazia, campo ausente) cai pra primeira
    // preferência real da marca em vez de propagar um estilo não solicitado.
    const recommendedStyle =
      typeof obj['recommendedStyle'] === 'string' &&
      input.stylePreferences.includes(obj['recommendedStyle'] as TemplateStyle)
        ? (obj['recommendedStyle'] as TemplateStyle)
        : fallbackStyle

    return { blocked: obj['blocked'], autoPublishEligible: obj['autoPublishEligible'], recommendedStyle }
  }

  private buildPrompt(input: ClassifyInput): string {
    const allowedLine =
      input.autoPublishTopics.length > 0
        ? `Tópicos liberados para publicação automática (sem revisão humana): ${input.autoPublishTopics.join(', ')}.`
        : 'Nenhum tópico foi liberado para publicação automática.'
    const blockedLine =
      input.blockedTopics.length > 0
        ? `Tópicos bloqueados (nunca devem virar post automático, nem rascunho): ${input.blockedTopics.join(', ')}.`
        : 'Nenhum tópico foi explicitamente bloqueado.'
    const styleLines = input.stylePreferences
      .map((style, i) => `${i + 1}. "${style}" (${TEMPLATE_STYLE_LABELS[style]})`)
      .join('\n')

    return `Você decide se uma pauta de conteúdo pode alimentar um pipeline de publicação autônoma em redes sociais,
e também escolhe o estilo visual do card entre as opções que a marca preferiu, na ordem abaixo.

Pauta encontrada:
- Título: "${input.topic.headline}"
- Resumo: "${input.topic.summary}"
- Por que foi sugerida: "${input.topic.rationale}"

${allowedLine}
${blockedLine}

Ordem de preferência de estilo visual da marca (do mais preferido pro menos preferido):
${styleLines}

"Faixa inferior"/"Faixa superior" (faixa sólida colorida com o texto) funcionam bem quando a legenda curta já
resume o gancho da notícia. "Overlay escuro" (texto direto sobre a foto, com gradiente) combina com temas mais
sérios/reflexivos, quando a imagem em si já carrega parte da mensagem. "Sem texto" só quando a imagem sozinha já
comunica o suficiente, sem precisar de gancho escrito.

Julgue o encaixe nos tópicos liberados/bloqueados por semântica, não por repetição literal de palavras — por
exemplo, "Caso do Dia com resultado real do produto" deve reconhecer uma pauta sobre um cliente relatando
resultado com o produto, mesmo sem repetir essa frase. Quando em dúvida sobre bloqueio, prefira bloquear — o
risco de publicar algo sensível pesa mais que o de perder uma publicação automática.

Responda apenas com um JSON no formato:
{"blocked": boolean, "autoPublishEligible": boolean, "recommendedStyle": string}

"blocked": true se a pauta se encaixa em algum tópico bloqueado.
"autoPublishEligible": true se a pauta se encaixa no espírito de algum tópico liberado para publicação automática
(irrelevante/false se nenhum tópico foi liberado).
"recommendedStyle": exatamente um dos valores entre aspas duplas listados acima em "Ordem de preferência de
estilo visual", o que melhor combina com esta pauta específica — na dúvida, prefira o mais alto na ordem de
preferência.`
  }
}
