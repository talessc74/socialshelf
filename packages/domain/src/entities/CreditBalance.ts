// Saldo de créditos de IA por usuário (_local-adr-policy-0NN) — substitui o teto de gasto
// diário em R$ (_local-edr-policy-073, descontinuado). Um CreditBalance por usuário, não por
// marca: o plano é contratado por usuário (mesmo raciocínio de Subscription), então contas com
// várias marcas (ex. Agência) compartilham um único saldo.
export interface CreditBalance {
  userId: string
  // Mês-calendário de Brasília ('YYYY-MM') em que planCreditsTotal/planCreditsUsed foram
  // calculados pela última vez. Comparado contra o mês atual a cada leitura para decidir se o
  // saldo do plano deve repor (reposição preguiçosa, sem job agendado — ver Credits.ts).
  periodKey: string
  planCreditsTotal: number
  planCreditsUsed: number
  // Créditos comprados avulsos (Stripe, mode 'payment') — não expiram e não são afetados pela
  // reposição mensal. Consumidos só depois que planCreditsTotal - planCreditsUsed chega a zero.
  purchasedCreditsBalance: number
  createdAt: Date
  updatedAt: Date
}
