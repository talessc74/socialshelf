import { VertexAI } from '@google-cloud/vertexai'
import type { TopicQueryPlannerPort, TopicQueryPlannerInput } from '@socialshelf/domain'

const MAX_QUERIES = 5

export class GeminiTopicQueryPlanner implements TopicQueryPlannerPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async planQueries(input: TopicQueryPlannerInput): Promise<string[]> {
    const vertexAi = new VertexAI({
      project: this.projectId,
      location: this.location,
      ...(this.location === 'global' && { apiEndpoint: 'aiplatform.googleapis.com' }),
    })
    const generativeModel = vertexAi.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = this.buildPrompt(input)
    const result = await generativeModel.generateContent(prompt)
    const text = result.response.candidates?.[0]?.content.parts[0]?.text
    if (!text) throw new Error('Gemini returned no content for topic query planning')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for topic query planning')
    }

    const queries = (parsed as Record<string, unknown>)?.['queries']
    if (
      !Array.isArray(queries) ||
      queries.length === 0 ||
      !queries.every((q) => typeof q === 'string' && q.trim().length > 0)
    ) {
      throw new Error('Gemini returned malformed topic query planning payload')
    }

    return (queries as string[]).slice(0, MAX_QUERIES)
  }

  private buildPrompt(input: TopicQueryPlannerInput): string {
    const themesLine =
      input.recurringThemes.length > 0
        ? `\nTemas recorrentes do conteúdo da marca: ${input.recurringThemes.join(', ')}.`
        : ''

    return `Você ajuda a planejar buscas de notícias para uma marca encontrar conteúdo relevante e com potencial viral para criar posts.

Negócio: "${input.business.name}", segmento "${input.business.segment}". Descrição: ${input.business.description}${themesLine}

A busca não deve se limitar ao segmento literal da marca — pense de forma ampla sobre categorias adjacentes que o público
dessa marca também acompanha e que dão à marca oportunidade de comentar algo relevante. Exemplo: uma "LegalTech" não deve
buscar só notícias jurídicas, mas também inteligência artificial, tecnologia e startups — assuntos que essa audiência
também consome e que ajudam a marca a aparecer em conversas maiores, não só no nicho jurídico.

Gere entre 3 e ${MAX_QUERIES} termos de busca curtos (1 a 3 palavras cada), em inglês — a busca roda em veículos
internacionais no Google News. Cubra o segmento principal da marca e categorias adjacentes relevantes, sem repetir o
mesmo termo de formas diferentes.

Responda apenas com um JSON no formato:
{"queries": ["...", "..."]}`
  }
}
