import type { CreditBalance } from '../entities/CreditBalance.js'

export interface CreditBalanceRepository {
  findByUserId(userId: string): Promise<CreditBalance | null>
  save(balance: CreditBalance): Promise<void>
}
