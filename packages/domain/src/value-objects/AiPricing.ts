// Preço público de lista da Vertex AI (não o preço com desconto/crédito real da fatura do
// projeto) — usado só para dar ao usuário uma ESTIMATIVA de gasto por chamada, nunca para
// reconciliar com a fatura real do Google Cloud. Gemini 2.5 Flash confirmado em
// cloud.google.com/vertex-ai/generative-ai/pricing ($0.30/1M tokens de entrada, $2.50/1M de
// saída). Imagen 4 Standard (imagen-4.0-generate-001, IMAGEN_MODEL) não tem tabela pública tão
// acessível quanto a do Gemini — $0.04/imagem é o valor consistentemente reportado por múltiplas
// fontes secundárias (ex.: futureagi.com, cloudprice.net) no momento da implementação; revisar
// se a Vertex AI publicar a tabela oficial completa de imagem.
export const GEMINI_FLASH_INPUT_USD_PER_1M_TOKENS = 0.3
export const GEMINI_FLASH_OUTPUT_USD_PER_1M_TOKENS = 2.5
export const IMAGEN_4_STANDARD_USD_PER_IMAGE = 0.04

export interface GeminiUsageTokens {
  promptTokenCount?: number | undefined
  candidatesTokenCount?: number | undefined
  // Tokens de "thinking" somam ao custo de saída mesmo não aparecendo na resposta visível —
  // devem ser 0 com thinkingBudget: 0 (_local-edr-policy-070), mas entram na conta se algum
  // call site reativar thinking no futuro.
  thoughtsTokenCount?: number | undefined
}

export function estimateGeminiCostUsd(usage: GeminiUsageTokens): number {
  const inputTokens = usage.promptTokenCount ?? 0
  const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)
  return (
    (inputTokens / 1_000_000) * GEMINI_FLASH_INPUT_USD_PER_1M_TOKENS +
    (outputTokens / 1_000_000) * GEMINI_FLASH_OUTPUT_USD_PER_1M_TOKENS
  )
}

export function estimateImagenCostUsd(imageCount: number): number {
  return imageCount * IMAGEN_4_STANDARD_USD_PER_IMAGE
}
