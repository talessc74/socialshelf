// Intervalo de proporção largura/altura que a Graph API do Instagram aceita pra publicar uma
// foto (feed/carrossel): 4:5 (retrato) até 1.91:1 (paisagem). Fora disso, o próprio Instagram
// rejeita o container com "The aspect ratio is not supported" — achado real em produção com uma
// foto panorâmica de iPhone (_local-edr-policy-066). Compartilhado entre apps/api (decide o que
// entra num carrossel de campanha) e apps/web (avisa qual foto especificamente é o problema ao
// editar um post que já falhou).
export const INSTAGRAM_MIN_ASPECT_RATIO = 4 / 5
export const INSTAGRAM_MAX_ASPECT_RATIO = 1.91

// Null (dimensões não determinadas) nunca é tratado como incompatível — sem o dado real, não
// arrisca um falso positivo.
export function isAspectRatioUnsupportedForInstagram(aspectRatio: number | null): boolean {
  if (aspectRatio === null) return false
  return aspectRatio < INSTAGRAM_MIN_ASPECT_RATIO || aspectRatio > INSTAGRAM_MAX_ASPECT_RATIO
}
