import { VertexAI } from '@google-cloud/vertexai'
import type { TranslatorPort, TranslateInput } from '@socialshelf/domain'

// Tradução fiel de manchetes/resumos de notícia para o idioma do usuário, reutilizando o mesmo
// cliente Vertex AI (Gemini) já usado na geração de cópia — sem infra nova. A fidelidade é
// requisito de governança (ADR-027): a fonte é rastreável e a tradução não pode distorcê-la.
export class GeminiTranslator implements TranslatorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async translate({ texts, targetLanguage }: TranslateInput): Promise<string[]> {
    if (texts.length === 0) return []

    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = `Traduza cada string do array abaixo para ${targetLanguage}.
Regras:
- Traduza com fidelidade jornalística: não resuma, não opine, não acrescente nem remova informação.
- Preserve nomes próprios, marcas e siglas como estão.
- Se uma string vier vazia, devolva string vazia.
- Devolva exatamente o mesmo número de itens, na mesma ordem.

Entrada (JSON array de strings):
${JSON.stringify(texts)}

Responda apenas com um JSON no formato:
{"translations": ["...", "..."]}`

    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for translation')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for translation')
    }

    const translations = (parsed as Record<string, unknown>)?.['translations']
    if (
      !Array.isArray(translations) ||
      translations.length !== texts.length ||
      !translations.every((t) => typeof t === 'string')
    ) {
      throw new Error('Gemini returned malformed translation payload')
    }

    return translations as string[]
  }
}
