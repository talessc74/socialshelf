import { describe, it, expect, beforeEach } from 'vitest'
import { estimateManualMinutes, formatMinutes, addTimeSaved, getTimeSavedTotal } from './selfieTimeSaved'

beforeEach(() => {
  window.localStorage.clear()
})

describe('estimateManualMinutes', () => {
  it('combina minutos por plataforma e por card', () => {
    expect(estimateManualMinutes(1, 1)).toBe(5 + 6)
    expect(estimateManualMinutes(3, 2)).toBe(15 + 12)
  })

  it('trata artifactCount menor que 1 como 1 card', () => {
    expect(estimateManualMinutes(2, 0)).toBe(10 + 6)
  })
})

describe('formatMinutes', () => {
  it('mostra só minutos abaixo de uma hora', () => {
    expect(formatMinutes(8)).toBe('8 min')
    expect(formatMinutes(59)).toBe('59 min')
  })

  it('mostra horas e minutos a partir de 60', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(75)).toBe('1h 15min')
    expect(formatMinutes(125)).toBe('2h 5min')
  })
})

describe('addTimeSaved / getTimeSavedTotal', () => {
  it('começa em zero sem histórico', () => {
    expect(getTimeSavedTotal()).toBe(0)
  })

  it('acumula entre chamadas sucessivas', () => {
    expect(addTimeSaved(10)).toBe(10)
    expect(addTimeSaved(15)).toBe(25)
    expect(getTimeSavedTotal()).toBe(25)
  })
})
