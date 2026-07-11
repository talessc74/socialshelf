const DAY_START_HOUR = 9
const DAY_END_HOUR = 21

// Horários (em decimal, ex: 15.5 = 15h30) igualmente espaçados dentro da janela comercial
// fixa (9h-21h, mesmo horário de Brasília assumido em toda a base — _local-edr-policy-041) —
// usado tanto pra distribuir os itens de uma campanha ao longo dos dias quanto pra decidir,
// no tick de autonomia, se já é hora do próximo post automático do dia.
export function computeDailySlotHours(postsPerDay: number): number[] {
  if (postsPerDay <= 1) return [DAY_START_HOUR]
  return Array.from(
    { length: postsPerDay },
    (_, i) => DAY_START_HOUR + (i * (DAY_END_HOUR - DAY_START_HOUR)) / (postsPerDay - 1),
  )
}
