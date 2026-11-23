import {
  Platform,
  type SelfieAssistantPort,
  type SelfieChatTurn,
  type SelfieAccountStatus,
  type AiUsageRecorderPort,
} from '@socialshelf/domain'
import { createGeminiClient, recordGeminiUsage } from './geminiClient.js'
import { SELFIE_KNOWLEDGE_BASE } from './selfieKnowledgeBase.js'

// Só os últimos N turnos vão pro prompt — limita o tamanho (e o custo) de uma conversa longa;
// o histórico completo nunca é persistido no servidor (_local-adr-policy-045, fora de escopo
// deste corte: sem histórico server-side).
const MAX_HISTORY_TURNS = 10

const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.TIKTOK]: 'TikTok',
}

export class GeminiSelfieAssistant implements SelfieAssistantPort {
  constructor(
    private readonly projectId: string,
    private readonly location: string,
    private readonly model: string,
    private readonly usageRecorder: AiUsageRecorderPort,
  ) {}

  async answer(
    question: string,
    history: SelfieChatTurn[],
    accountStatus: SelfieAccountStatus[],
    userId: string,
    brandId: string,
  ): Promise<string> {
    const ai = createGeminiClient(this.projectId, this.location)

    const prompt = this.buildPrompt(question, history, accountStatus)
    const result = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    })
    recordGeminiUsage(this.usageRecorder, { userId, brandId, operation: 'selfie-chat', model: this.model }, result.usageMetadata)

    const text = result.text?.trim()
    if (!text) throw new Error('Gemini returned no content for selfie chat')
    return text
  }

  private buildPrompt(question: string, history: SelfieChatTurn[], accountStatus: SelfieAccountStatus[]): string {
    const accountSection = accountStatus.length
      ? accountStatus
          .map((a) => {
            const label = PLATFORM_LABELS[a.platform] ?? a.platform
            if (!a.connected) return `- ${label}: não conectada`
            const flag = a.connectionLikelyExpired
              ? ' (sinal de que a conexão pode ter expirado — sugira reconectar)'
              : ''
            return `- ${label}: conectada${a.accountLabel ? ` (${a.accountLabel})` : ''}${flag}`
          })
          .join('\n')
      : '(nenhuma informação de conexão disponível)'

    const historySection = history
      .slice(-MAX_HISTORY_TURNS)
      .map((turn) => `${turn.role === 'user' ? 'Usuário' : 'Selfie'}: ${turn.text}`)
      .join('\n')

    return `Você é o Selfie, o assistente de produto do SocialShelf — simpático, direto e prestativo.

REGRAS IMPORTANTES:
- Responda só sobre como usar o SocialShelf, com base na base de conhecimento abaixo e no estado de conexão da marca.
- Se a pergunta não tiver nenhuma relação com o SocialShelf (ex: perguntas gerais de cultura, matemática, outros assuntos), recuse educadamente, dizendo que só pode ajudar com dúvidas sobre o produto.
- Nunca invente um recurso, botão ou comportamento que não está na base de conhecimento.
- Se não souber a resposta com certeza, diga isso em vez de inventar.
- Responda em português do Brasil, em tom conversacional e curto (poucos parágrafos, sem listas longas desnecessárias).

# Base de conhecimento do produto
${SELFIE_KNOWLEDGE_BASE}

# Estado atual das conexões desta marca
${accountSection}

${historySection ? `# Conversa até agora\n${historySection}\n` : ''}
# Pergunta do usuário
${question}`
  }
}
