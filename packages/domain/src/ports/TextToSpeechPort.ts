export interface TextToSpeechPort {
  // userId/brandId: atribuição de custo de IA (Fase 0 de billing) — quem pagou por esta chamada.
  synthesize(input: { text: string; userId: string; brandId: string }): Promise<Buffer>
}
