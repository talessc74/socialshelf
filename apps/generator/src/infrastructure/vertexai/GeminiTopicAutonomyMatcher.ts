import { VertexAI } from '@google-cloud/vertexai'
import type { TopicAutonomyMatcherPort, TopicAutonomyMatch } from '@socialshelf/domain'

// Julga se uma pauta se encaixa nos temas que o usuário liberou/bloqueou para publicação
// autônoma (_local-bdr-plan-002, Fase 4) — correspondência semântica, não palavra-chave
// literal, pelo mesmo motivo de GeminiAudienceFitScorer: "Caso do Dia com resultado real do
// produto" deve reconhecer uma pauta sobre um case de cliente mesmo sem repetir esse texto.
export class GeminiTopicAutonomyMatcher implements TopicAutonomyMatcherPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async classify(input: {
    topic: { headline: string; summary: string; rationale: string }
    autoPublishTopics: string[]
    blockedTopics: string[]
  }): Promise<TopicAutonomyMatch> {
    // Sem nenhum tópico liberado, não há como o modo automático publicar sozinho — e sem
    // nenhum bloqueado, nada bloqueia. Evita uma chamada de IA para responder algo que já
    // sabemos sem julgamento nenhum.
    if (input.autoPublishTopics.length === 0 && input.blockedTopics.length === 0) {
      return { blocked: false, autoPublishEligible: false }
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

    return { blocked: obj['blocked'], autoPublishEligible: obj['autoPublishEligible'] }
  }

  private buildPrompt(input: {
    topic: { headline: string; summary: string; rationale: string }
    autoPublishTopics: string[]
    blockedTopics: string[]
  }): string {
    const allowedLine =
      input.autoPublishTopics.length > 0
        ? `Tópicos liberados para publicação automática (sem revisão humana): ${input.autoPublishTopics.join(', ')}.`
        : 'Nenhum tópico foi liberado para publicação automática.'
    const blockedLine =
      input.blockedTopics.length > 0
        ? `Tópicos bloqueados (nunca devem virar post automático, nem rascunho): ${input.blockedTopics.join(', ')}.`
        : 'Nenhum tópico foi explicitamente bloqueado.'

    return `Você decide se uma pauta de conteúdo pode alimentar um pipeline de publicação autônoma em redes sociais.

Pauta encontrada:
- Título: "${input.topic.headline}"
- Resumo: "${input.topic.summary}"
- Por que foi sugerida: "${input.topic.rationale}"

${allowedLine}
${blockedLine}

Julgue por encaixe semântico, não por repetição literal de palavras — por exemplo, "Caso do Dia com resultado real
do produto" deve reconhecer uma pauta sobre um cliente relatando resultado com o produto, mesmo sem repetir essa
frase. Quando em dúvida sobre bloqueio, prefira bloquear — o risco de publicar algo sensível pesa mais que o de
perder uma publicação automática.

Responda apenas com um JSON no formato:
{"blocked": boolean, "autoPublishEligible": boolean}

"blocked": true se a pauta se encaixa em algum tópico bloqueado.
"autoPublishEligible": true se a pauta se encaixa no espírito de algum tópico liberado para publicação automática
(irrelevante/false se nenhum tópico foi liberado).`
  }
}
