import { VertexAI } from '@google-cloud/vertexai'
import { z } from 'zod'
import type { PatternAnalyzerPort, PostPerformanceSummary, ProfileDiagnostic } from '@socialshelf/domain'

const profileDiagnosticSchema = z.object({
  niche: z.string(),
  diagnosisSummary: z.string(),
  viralPotential: z.number().min(0).max(100),
  whatWorks: z.array(z.object({ title: z.string(), description: z.string() })),
  engagingThemes: z.array(z.object({ label: z.string(), strength: z.number().min(0).max(100) })),
  topFormats: z.array(z.string()),
  bestTimes: z.array(z.string()),
  engagementAnalysis: z.string(),
  actionPlan: z.array(z.object({ title: z.string(), description: z.string() })),
})

export class GeminiPatternAnalyzer implements PatternAnalyzerPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async analyzePatterns(entries: PostPerformanceSummary[]): Promise<ProfileDiagnostic> {
    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({ model: this.model })

    const prompt = this.buildPrompt(entries)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for pattern analysis')

    const jsonText = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '')

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(jsonText)
    } catch {
      throw new Error('Gemini returned invalid JSON for pattern analysis')
    }

    const parsed = profileDiagnosticSchema.safeParse(parsedJson)
    if (!parsed.success) {
      throw new Error(`Gemini returned a diagnostic that doesn't match the expected shape: ${parsed.error.message}`)
    }

    return parsed.data
  }

  private buildPrompt(entries: PostPerformanceSummary[]): string {
    const postsSection = entries
      .map(
        (e, i) =>
          `${i + 1}. [${e.platform}] "${e.text}" — impressões: ${e.metrics.impressions}, curtidas: ${e.metrics.likes}, comentários: ${e.metrics.comments}, compartilhamentos: ${e.metrics.shares}, score: ${e.score}`,
      )
      .join('\n')

    return `Você é um analista de marketing de redes sociais. Abaixo está a performance medida de posts já publicados, ordenados por score (impressões + curtidas + comentários + compartilhamentos) decrescente.

${postsSection}

Gere um diagnóstico de perfil em português, baseado apenas nos dados fornecidos — não invente métricas ou posts que não estão na lista. Responda APENAS com um JSON válido (sem markdown, sem texto fora do JSON) no seguinte formato exato:

{
  "niche": "nicho/segmento detectado a partir do conteúdo dos posts",
  "diagnosisSummary": "parágrafo com o diagnóstico geral do perfil: pontos fortes e o principal desafio",
  "viralPotential": <número de 0 a 100 estimando o potencial viral atual do perfil>,
  "whatWorks": [{ "title": "título curto", "description": "explicação" }, ...],
  "engagingThemes": [{ "label": "tema abordado nos posts", "strength": <número de 0 a 100 indicando a força de engajamento desse tema> }, ...],
  "topFormats": ["formatos de post que mais performam, ex: CAROUSEL_ALBUM, IMAGE, VIDEO"],
  "bestTimes": ["horários no formato HH:MM em que os posts performam melhor, com base nos dados"],
  "engagementAnalysis": "parágrafo analisando o padrão de engajamento (curtidas vs comentários vs compartilhamentos)",
  "actionPlan": [{ "title": "título curto da ação", "description": "explicação prática da recomendação" }, ...]
}

Inclua de 3 a 5 itens em "whatWorks", "engagingThemes" e "actionPlan". Não inclua nenhum texto antes ou depois do JSON.`
  }
}
