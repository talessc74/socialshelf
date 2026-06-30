import { VertexAI } from '@google-cloud/vertexai'
import { z } from 'zod'
import type { PerformanceSuggesterPort, PerformanceSuggestionDraft, ProfileDiagnostic } from '@socialshelf/domain'

const suggestionDraftSchema = z.object({
  headline: z.string(),
  rationale: z.string(),
  viralScore: z.number().min(0).max(100),
  basedOnThemes: z.array(z.string()),
  bestTimeToPost: z.string(),
  bestTimeWeekdays: z.array(z.number().int().min(0).max(6)).min(1),
  bestTimeHourStart: z.number().int().min(0).max(23),
  bestTimeHourEnd: z.number().int().min(0).max(23),
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
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = this.buildPrompt(diagnostic)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for performance suggestions')

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(text)
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
    const bestTimesSection = diagnostic.bestTimes.join(', ')

    return `Você é um estrategista de conteúdo para redes sociais. Abaixo está o diagnóstico de performance do perfil de uma marca, baseado nos posts já publicados.

Nicho: ${diagnostic.niche}
Diagnóstico geral: ${diagnostic.diagnosisSummary}
Potencial viral atual do perfil: ${diagnostic.viralPotential}/100
Temas que mais engajam:
${themesSection}
Formatos que mais performam: ${formatsSection}
Melhores horários observados de engajamento: ${bestTimesSection}
Plano de ação recomendado:
${actionsSection}

Com base apenas nesses dados, gere de 2 a 3 ideias concretas de novos posts que essa marca poderia publicar para repetir o que já funcionou e aumentar as chances de viralizar. Para cada ideia, também estime o melhor momento para publicá-la, com base nos melhores horários observados de engajamento. Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato exato:

{
  "suggestions": [
    {
      "headline": "ideia de post em uma frase, pronta para usar como descrição de geração de conteúdo",
      "rationale": "por que essa ideia tem potencial, citando os temas/formatos que a sustentam",
      "viralScore": <número de 0 a 100 estimando o potencial viral dessa ideia específica>,
      "basedOnThemes": ["tema 1 usado como base", "tema 2"],
      "bestTimeToPost": "descrição curta e amigável em português do melhor momento para publicar, ex: 'Quintas-feiras à noite'",
      "bestTimeWeekdays": [<dias da semana recomendados, 0=domingo a 6=sábado, pelo menos 1>],
      "bestTimeHourStart": <hora de início da janela recomendada, 0-23>,
      "bestTimeHourEnd": <hora de fim da janela recomendada, 0-23>
    }
  ]
}

Não inclua nenhum texto antes ou depois do JSON.`
  }
}
