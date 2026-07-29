// Data corrente em Brasília, formato 'YYYY-MM-DD'. Extraído de apps/publisher/AutonomyTickUseCase
// (mesmo cálculo, mesmo achado real de produção documentado ali): usar o calendário UTC
// (`toISOString().slice(0,10)`) em vez do de Brasília fazia o contador diário virar cedo demais
// (0h-3h UTC já é o dia seguinte em UTC, mas ainda o fim de tarde/noite do dia anterior em
// Brasília). Compartilhado porque a trava de gasto diário de IA precisa do mesmo "dia" que o
// tick de autonomia já usa para o contador de posts.
export function brasiliaDateNow(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

// Início do dia corrente em Brasília, como instante UTC — Brasil não observa horário de verão
// desde 2019, então o offset fixo -03:00 vale o ano inteiro (mesma suposição já implícita em
// brasiliaDateNow/AutonomyTickUseCase).
export function startOfBrasiliaDay(now: Date): Date {
  return new Date(`${brasiliaDateNow(now)}T03:00:00.000Z`)
}
