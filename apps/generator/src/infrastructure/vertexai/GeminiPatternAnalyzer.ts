import { VertexAI } from '@google-cloud/vertexai'
import { z } from 'zod'
import type { PatternAnalyzerPort, PostPerformanceSummary, ProfileDiagnostic } from '@socialshelf/domain'

// Gemini ocasionalmente devolve um campo de lista como uma única string (ex.: "08:00, 14:00")
// em vez de array — normaliza para array antes de validar, em vez de rejeitar o diagnóstico inteiro.
const stringArray = z.preprocess(
  (val) => (typeof val === 'string' ? val.split(',').map((s) => s.trim()).filter(Boolean) : val),
  z.array(z.string()),
)

// Sem isso, "bestTimes" seria um chute do modelo sem nenhum dado real de horário —
// o prompt já pedia "com base nos dados", mas os dados nunca incluíam quando cada post saiu.
const publishedAtFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const profileDiagnosticSchema = z.object({
  niche: z.string(),
  diagnosisSummary: z.string(),
  viralPotential: z.number().min(0).max(100),
  whatWorks: z.array(z.object({ title: z.string(), description: z.string() })),
  engagingThemes: z.array(z.object({ label: z.string(), strength: z.number().min(0).max(100) })),
  topFormats: stringArray,
  bestTimes: stringArray,
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
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = this.buildPrompt(entries)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for pattern analysis')

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(text)
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
          `${i + 1}. [${e.platform}] publicado ${publishedAtFormatter.format(e.publishedAt)} (horário de Brasília) — "${e.text}" — impressões: ${e.metrics.impressions}, curtidas: ${e.metrics.likes}, comentários: ${e.metrics.comments}, compartilhamentos: ${e.metrics.shares}, score: ${e.score}`,
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
