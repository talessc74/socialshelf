import { describe, it, expect } from 'vitest'
import { resolveEffectiveDailyLimitBrl } from './aiSpendingLimit.js'

describe('resolveEffectiveDailyLimitBrl', () => {
  it('devolve o teto do plano quando a marca não configurou nenhum', () => {
    expect(resolveEffectiveDailyLimitBrl(null, 50)).toBe(50)
  })

  it('devolve o teto da marca quando o plano não impõe nenhum (legado/admin)', () => {
    expect(resolveEffectiveDailyLimitBrl(100, null)).toBe(100)
  })

  it('devolve null (sem teto) quando nem marca nem plano configuram limite', () => {
    expect(resolveEffectiveDailyLimitBrl(null, null)).toBeNull()
  })

  it('devolve o menor dos dois quando ambos existem — teto do plano mais baixo vence', () => {
    expect(resolveEffectiveDailyLimitBrl(100, 5)).toBe(5)
  })

  it('devolve o menor dos dois quando ambos existem — teto da marca mais baixo vence', () => {
    expect(resolveEffectiveDailyLimitBrl(5, 100)).toBe(5)
  })
})
