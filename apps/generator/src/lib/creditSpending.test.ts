import { describe, it, expect } from 'vitest'
import { resolveEffectiveMaxArtifacts, hasCreditsAvailable } from './creditSpending.js'

describe('resolveEffectiveMaxArtifacts', () => {
  it('devolve o teto normal (10) quando o saldo é ilimitado', () => {
    expect(resolveEffectiveMaxArtifacts(null)).toBe(10)
  })

  it('clampa pelo saldo disponível quando é menor que o teto normal', () => {
    expect(resolveEffectiveMaxArtifacts(4)).toBe(4)
  })

  it('nunca passa do teto normal mesmo com saldo maior', () => {
    expect(resolveEffectiveMaxArtifacts(500)).toBe(10)
  })

  it('arredonda pra baixo saldo fracionário (não deveria existir, mas por segurança)', () => {
    expect(resolveEffectiveMaxArtifacts(3.7)).toBe(3)
  })

  it('nunca fica negativo', () => {
    expect(resolveEffectiveMaxArtifacts(-5)).toBe(0)
  })
})

describe('hasCreditsAvailable', () => {
  it('ilimitado sempre tem saldo', () => {
    expect(hasCreditsAvailable(null)).toBe(true)
  })

  it('saldo positivo tem saldo', () => {
    expect(hasCreditsAvailable(1)).toBe(true)
  })

  it('saldo zero não tem saldo', () => {
    expect(hasCreditsAvailable(0)).toBe(false)
  })
})
