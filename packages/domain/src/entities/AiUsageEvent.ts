// Uma chamada de IA (texto ou imagem) medida e atribuída a uma marca — base tanto da tela de
// gastos por conta/mês quanto da trava de gasto diária. `category` separa por fase (texto vs
// imagem) porque o usuário precisa medir cada fase separadamente, não só o total.
export type AiUsageCategory = 'text-generation' | 'image-generation'

export interface AiUsageEvent {
  id: string
  userId: string
  brandId: string
  category: AiUsageCategory
  // Nome curto e estável da chamada de origem (ex.: 'copy-generation', 'art-direction',
  // 'imagen-generation') — granularidade abaixo de `category` para o usuário entender de
  // onde vem o gasto, não só se foi texto ou imagem.
  operation: string
  model: string
  // Tokens reais devolvidos pela API do Gemini (usageMetadata) — null para chamadas de imagem,
  // que não têm contagem de token. thoughtsTokenCount deve ser 0 com thinking desligado por
  // padrão (_local-edr-policy-070), mas o campo existe pra medir se algum call site reativar.
  promptTokenCount: number | null
  candidatesTokenCount: number | null
  thoughtsTokenCount: number | null
  // Quantidade de imagens geradas nesta chamada — null para chamadas de texto.
  imageCount: number | null
  estimatedCostUsd: number
  createdAt: Date
}
