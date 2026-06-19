import { VertexAI } from '@google-cloud/vertexai'
import type { PatternAnalyzerPort, PostPerformanceSummary } from '@socialshelf/domain'

export class GeminiPatternAnalyzer implements PatternAnalyzerPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async analyzePatterns(entries: PostPerformanceSummary[]): Promise<string> {
    const vertexAi = new VertexAI({ project: this.projectId, location: this.location })
    const generativeModel = vertexAi.getGenerativeModel({ model: this.model })

    const prompt = this.buildPrompt(entries)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for pattern analysis')

    return text.trim()
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

Analise os padrões entre os posts de melhor e pior desempenho. Identifique, em português, de forma direta e prática:
- Que temas, formatos ou tons aparecem nos posts de melhor desempenho.
- O que parece não funcionar nos posts de pior desempenho.
- 2 a 3 recomendações concretas para os próximos posts.

Baseie-se apenas nos dados fornecidos — não invente métricas ou posts que não estão na lista. Responda em texto corrido, sem JSON.`
  }
}
