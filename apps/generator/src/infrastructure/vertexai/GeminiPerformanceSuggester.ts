import { VertexAI } from '@google-cloud/vertexai'
import { z } from 'zod'
import type { PerformanceSuggesterPort, PerformanceSuggestionDraft, ProfileDiagnostic } from '@socialshelf/domain'

const suggestionDraftSchema = z.object({
  headline: z.string(),
  rationale: z.string(),
  viralScore: z.number().min(0).max(100),
  basedOnThemes: z.array(z.string()),
})

const responseSchema = z.object({ suggestions: z.array(suggestionDraftSchema) })

export class GeminiPerformanceSuggester implements PerformanceSuggesterPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async suggestPosts(diagnostic: ProfileDiagnostic): Promise<PerformanceSuggestionDraft[]> {
    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({ model: this.model })

    const prompt = this.buildPrompt(diagnostic)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for performance suggestions')

    const jsonText = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(jsonText)
    } catch {
      throw new Error('Gemini returned invalid JSON for performance suggestions')
    }

    const parsed = responseSchema.safeParse(parsedJson)
    if (!parsed.success) {
      throw new Error(`Gemini returned suggestions that don't match the expected shape: ${parsed.error.message}`)
    }

    return parsed.data.suggestions
  }

  private buildPrompt(diagnostic: ProfileDiagnostic): string {
    const themesSection = diagnostic.engagingThemes
      .map((t) => `- ${t.label} (força de engajamento: ${t.strength}/100)`)
      .join('\n')
    const formatsSection = diagnostic.topFormats.join(', ')
    const actionsSection = diagnostic.actionPlan.map((a) => `- ${a.title}: ${a.description}`).join('\n')

    return `Você é um estrategista de conteúdo para redes sociais. Abaixo está o diagnóstico de performance do perfil de uma marca, baseado nos posts já publicados.

Nicho: ${diagnostic.niche}
Diagnóstico geral: ${diagnostic.diagnosisSummary}
Potencial viral atual do perfil: ${diagnostic.viralPotential}/100
Temas que mais engajam:
${themesSection}
Formatos que mais performam: ${formatsSection}
Plano de ação recomendado:
${actionsSection}

Com base apenas nesses dados, gere de 2 a 3 ideias concretas de novos posts que essa marca poderia publicar para repetir o que já funcionou e aumentar as chances de viralizar. Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato exato:

{
  "suggestions": [
    {
      "headline": "ideia de post em uma frase, pronta para usar como descrição de geração de conteúdo",
      "rationale": "por que essa ideia tem potencial, citando os temas/formatos que a sustentam",
      "viralScore": <número de 0 a 100 estimando o potencial viral dessa ideia específica>,
      "basedOnThemes": ["tema 1 usado como base", "tema 2"]
    }
  ]
}

Não inclua nenhum texto antes ou depois do JSON.`
  }
}
