import { VertexAI } from '@google-cloud/vertexai'
import type { ArtDirectorPort, ArtDirectionInput, ArtDirectionResult, ArtifactDirection } from '@socialshelf/domain'

export class GeminiArtDirector implements ArtDirectorPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
  ) {}

  async direct(input: ArtDirectionInput): Promise<ArtDirectionResult> {
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
    if (!text) throw new Error('Gemini returned no content for art direction')

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Gemini returned invalid JSON for art direction')
    }

    return this.toArtDirectionResult(parsed, input.artifacts)
  }

  // ---------------------------------------------------------------------
  // Persona do diretor de arte — quem ele é e como ele pensa. Edite só este
  // método para refinar a personalidade, sem tocar no resto do adapter.
  // ---------------------------------------------------------------------
  private personaInstructions(): string {
    return `Você é um diretor de arte sênior especializado em redes sociais, com domínio de fotografia editorial, ilustração e identidade de marca. Sua única função é escrever instruções de geração de imagem para um modelo de IA generativa — você nunca gera a imagem, apenas a instrução que outro modelo vai seguir.

Princípios que você sempre aplica:
1. Escolha UMA linguagem visual (fotografia realista OU ilustração estilizada — nunca misture as duas num mesmo post) e aplique essa mesma linguagem a todos os artefatos do post, mantendo iluminação, paleta e textura consistentes entre eles.
2. Traduza o tom de voz da marca em decisões visuais concretas (iluminação, enquadramento, paleta, textura) — nunca repita o adjetivo do tom como se ele já fosse uma instrução visual.
3. Depois da imagem gerada, uma barra de cor sólida da marca será sobreposta numa das bordas para receber o headline. Componha a cena para que essa borda já pareça uma escolha de design: menos elementos de interesse ali, tom mais uniforme, nunca o assunto principal da foto cortado por ela.
4. Nunca peça texto, letras, números, placas ou tipografia dentro da imagem — isso é proibido e será adicionado depois, separadamente.
5. Escreva cada instrução como uma cena específica e concreta (sujeito, ação, ambiente, luz, cor, composição) — nunca uma frase genérica como "a person smiling at camera".`
  }

  private buildPrompt(input: ArtDirectionInput): string {
    const formatSection =
      input.artifacts.length > 1
        ? `Este post é um carrossel de ${input.artifacts.length} imagens, vistas em sequência pela mesma pessoa. Garanta uma identidade visual única que amarre todas elas (mesma linguagem visual, paleta e luz), variando apenas a cena de cada uma.`
        : 'Este post tem uma única imagem.'

    const platformsSection = ` Plataformas de destino: ${input.targetPlatforms.join(', ')}.`

    const voiceSection = input.brandVoice ? ` Tom de voz da marca: "${input.brandVoice.tone}".` : ''

    const brandSection = input.brandTokens
      ? ` Referência tipográfica da marca: ${input.brandTokens.typography}. Cor primária da marca (usada na barra de texto): ${input.brandTokens.primaryColor}. Cor secundária: ${input.brandTokens.secondaryColor}.`
      : ''

    const pautaSection = input.pautaContext
      ? ` Contexto da pauta: "${input.pautaContext.headline}" — ${input.pautaContext.rationale}.`
      : ''

    const artifactsSection = input.artifacts
      .map((a) => `- Posição ${a.position}: headline "${a.headline}". Ideia de cena do roteirista: "${a.visualBrief}".`)
      .join('\n')

    return `${this.personaInstructions()}

Contexto deste post:
Descrição original: ${input.description}
${formatSection}${platformsSection}${voiceSection}${brandSection}${pautaSection}
Estilo de moldura escolhido: ${input.style}. Proporção: ${input.aspectRatio}.

Para cada posição abaixo, escreva uma instrução de imagem (imagePrompt, em inglês) seguindo os princípios acima. A ideia de cena do roteirista é só um ponto de partida — refine-a com sua direção de arte, não a copie literalmente.

${artifactsSection}

Responda apenas com um JSON no formato:
{"artifacts": [{"position": 0, "imagePrompt": "..."}]}
Inclua exatamente uma entrada para cada posição listada acima, nesta mesma ordem.`
  }

  private toArtDirectionResult(parsed: unknown, artifacts: ArtDirectionInput['artifacts']): ArtDirectionResult {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Gemini returned malformed art direction payload')
    }
    const rawArtifacts = (parsed as Record<string, unknown>)['artifacts']
    if (!Array.isArray(rawArtifacts) || rawArtifacts.length !== artifacts.length) {
      throw new Error('Gemini returned malformed art direction payload')
    }

    const expectedPositions = new Set(artifacts.map((a) => a.position))
    const directions: ArtifactDirection[] = []
    for (const item of rawArtifacts) {
      if (typeof item !== 'object' || item === null) {
        throw new Error('Gemini returned malformed art direction payload')
      }
      const { position, imagePrompt } = item as Record<string, unknown>
      if (
        typeof position !== 'number' ||
        !expectedPositions.has(position) ||
        typeof imagePrompt !== 'string' ||
        imagePrompt.trim().length === 0
      ) {
        throw new Error('Gemini returned malformed art direction payload')
      }
      directions.push({ position, imagePrompt })
    }

    if (new Set(directions.map((d) => d.position)).size !== expectedPositions.size) {
      throw new Error('Gemini returned malformed art direction payload')
    }

    return { artifacts: directions }
  }
}
