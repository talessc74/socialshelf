import type { Platform } from '../entities/Platform.js'

export interface SelfieChatTurn {
  role: 'user' | 'selfie'
  text: string
}

// Resumo do estado de conexão de uma rede, montado pela apps/api a partir do
// OAuthRepository real (nunca confiado do cliente) — dá ao Selfie contexto pra respostas
// específicas ("sua conexão com o Instagram expirou") em vez de só conhecimento genérico.
export interface SelfieAccountStatus {
  platform: Platform
  connected: boolean
  accountLabel: string | null
  // true quando expiresAt já passou — sinal de "provavelmente precisa reconectar", não uma
  // garantia (só uma chamada real à API da rede confirma; ver _local-adr-policy-045).
  connectionLikelyExpired: boolean
}

export interface SelfieAssistantPort {
  // userId/brandId: atribuição de custo de IA, mesmo padrão de PatternAnalyzerPort.
  answer(
    question: string,
    history: SelfieChatTurn[],
    accountStatus: SelfieAccountStatus[],
    userId: string,
    brandId: string,
  ): Promise<string>
}
