// Estimativa de tempo manual poupado ao gerar conteúdo com o SocialShelf.
// Constantes são suposição documentada, não medição real — evita soar como
// exagero de marketing. Ajustáveis se o valor não parecer plausível na prática.
const MINUTES_PER_PLATFORM = 5 // adaptar texto/formatar/publicar por rede, manualmente
const MINUTES_PER_CARD = 6 // escrever + desenhar cada card manualmente

const TIME_SAVED_KEY = 'socialshelf:selfie:timeSavedMinutes'

export function estimateManualMinutes(platformCount: number, artifactCount: number): number {
  return MINUTES_PER_PLATFORM * platformCount + MINUTES_PER_CARD * Math.max(artifactCount, 1)
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded} min`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`
}

/** Soma minutes ao total acumulado (localStorage, por dispositivo) e retorna o novo total. */
export function addTimeSaved(minutes: number): number {
  const total = getTimeSavedTotal() + minutes
  window.localStorage.setItem(TIME_SAVED_KEY, String(total))
  return total
}

/** Leitura do total acumulado sem somar — usado pelo Início. */
export function getTimeSavedTotal(): number {
  const raw = window.localStorage.getItem(TIME_SAVED_KEY)
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) ? parsed : 0
}
