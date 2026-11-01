import type { CreditBalance } from '../entities/CreditBalance.js'

export interface CreditBalanceRepository {
  findByUserId(userId: string): Promise<CreditBalance | null>
  save(balance: CreditBalance): Promise<void>
  // Lê e grava o saldo numa única transação — `mutate` recebe o estado mais recente de dentro
  // da transação (nunca um snapshot lido antes, fora dela) e devolve o que deve ser persistido.
  // Usado sempre que o ciclo ler → calcular → gravar precisa ser atômico, pra duas escritas
  // concorrentes do mesmo usuário não perderem uma à outra (lost update) — ex.: duas gerações
  // simultâneas descontando crédito ao mesmo tempo.
  atomicUpdate(userId: string, mutate: (current: CreditBalance | null) => CreditBalance): Promise<CreditBalance>
  // Credita um pacote avulso comprado, mas só uma vez por `sessionId` (id da Checkout Session
  // do Stripe) — protege contra o Stripe reenviar o mesmo webhook (retry em timeout/5xx é
  // esperado, não uma falha do Stripe). Chamadas repetidas com o mesmo `sessionId` depois da
  // primeira são no-op. A checagem de dedup e a gravação do saldo acontecem na mesma transação.
  applyPurchaseOnce(
    userId: string,
    sessionId: string,
    planMonthlyCredits: number | null,
    amount: number,
    now: Date,
  ): Promise<void>
}
