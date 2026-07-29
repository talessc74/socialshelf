import type { AudienceFitScorerPort, AudienceFitScorerInput, AudienceFitResult } from '@socialshelf/domain'
import { createGeminiClient } from './geminiClient.js'

const MIN_STRENGTH = 0
const MAX_STRENGTH = 3

// Avalia aderência por relevância semântica ao negócio da marca, não por correspondência literal
// de palavras com os temas recorrentes — uma notícia sobre "IA vence causa no Reino Unido" deve
// pontuar para uma LegalTech de IA mesmo sem citar nenhuma palavra exata do cadastro.
export class GeminiAudienceFitScorer implements AudienceFitScorerPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async score(input: AudienceFitScorerInput): Promise<AudienceFitResult[]> {
    if (input.items.length === 0) return []

    const ai = createGeminiClient(this.projectId, this.location)

    const prompt = this.buildPrompt(input)
    const result = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
    })
    const text = result.text
    if (!text) throw new Error('Gemini returned no content for audience fit scoring')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for audience fit scoring')
    }

    const items = (parsed as Record<string, unknown>)?.['items']
    if (!Array.isArray(items) || items.length !== input.items.length) {
      throw new Error('Gemini returned malformed audience fit scoring payload')
    }

    return items.map((rawItem) => {
      const obj = rawItem as Record<string, unknown>
      const relevanceStrength = obj['relevanceStrength']
      const matchedThemes = obj['matchedThemes']
      if (
        typeof relevanceStrength !== 'number' ||
        !Array.isArray(matchedThemes) ||
        !matchedThemes.every((t) => typeof t === 'string')
      ) {
        throw new Error('Gemini returned malformed audience fit scoring payload')
      }
      return {
        relevanceStrength: Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(relevanceStrength))),
        matchedThemes,
      }
    })
  }

  private buildPrompt(input: AudienceFitScorerInput): string {
    const themesLine =
      input.recurringThemes.length > 0
        ? `Temas recorrentes cadastrados pela marca: ${input.recurringThemes.join(', ')}.`
        : 'A marca não cadastrou temas recorrentes.'

    const itemsBlock = input.items
      .map((item, i) => `${i}. Título: "${item.headline}" — Resumo: "${item.summary}"`)
      .join('\n')

    return `Você avalia a aderência de notícias ao conteúdo de uma marca para decidir se vale a pena criar um post a partir delas.

Negócio: "${input.business.name}", segmento "${input.business.segment}". Descrição: ${input.business.description}
${themesLine}

Para cada notícia abaixo, avalie sua relevância semântica para esta marca — considere tanto correspondência com os
temas recorrentes cadastrados quanto relevância para o segmento e negócio da marca de forma mais ampla, mesmo que a
notícia não cite literalmente nenhum tema cadastrado (ex.: uma notícia sobre "IA vence causa no Reino Unido" é
relevante para uma LegalTech de IA mesmo sem repetir nenhuma palavra exata do cadastro).

Notícias:
${itemsBlock}

Para cada notícia, na mesma ordem, responda com:
- "relevanceStrength": inteiro de 0 a 3 (0 = nenhuma relevância, 1 = relevância periférica, 2 = relevância clara, 3 = relevância excelente, altamente compartilhável por esta marca)
- "matchedThemes": lista dos temas recorrentes cadastrados que esta notícia realmente toca, copiados exatamente como cadastrados — vazio se nenhum

Responda apenas com um JSON no formato:
{"items": [{"relevanceStrength": 0, "matchedThemes": []}, ...]}`
  }
}
