// Uma chamada de IA (texto, imagem, áudio ou vídeo) medida e atribuída a uma marca — base tanto
// da tela de gastos por conta/mês quanto da trava de gasto diária. `category` separa por fase
// (texto vs imagem vs áudio vs vídeo) porque o usuário precisa medir cada fase separadamente,
// não só o total. 'audio-synthesis' é a narração via Google Text-to-Speech (custo real,
// cobrado por caractere). 'video-composition' é a composição de slideshow via FFmpeg
// (Cloud Run compute, não uma API externa cobrada por unidade) — existe só para observabilidade
// de volume, sempre com estimatedCostUsd: 0 (ver FfmpegVideoComposer).
export type AiUsageCategory = 'text-generation' | 'image-generation' | 'audio-synthesis' | 'video-composition'

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
