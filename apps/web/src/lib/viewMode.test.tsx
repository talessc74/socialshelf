import { describe, it, expect, beforeEach } from 'vitest'
import { isAdminEmail } from '@socialshelf/domain'
import { readViewMode, writeViewMode, DEFAULT_VIEW_MODE } from './viewMode'

describe('viewMode - isAdminEmail', () => {
  it('reconhece o e-mail do administrador', () => {
    expect(isAdminEmail('talessc@me.com')).toBe(true)
  })

  it('ignora caixa e espaços em volta', () => {
    expect(isAdminEmail('  TalessC@ME.com ')).toBe(true)
  })

  it('nega e-mail comum', () => {
    expect(isAdminEmail('alguem@exemplo.com')).toBe(false)
  })

  it('nega o e-mail parecido de outro domínio', () => {
    expect(isAdminEmail('talessc@mac.com')).toBe(false)
  })

  it('nega null/undefined/vazio', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })
})

describe('viewMode - read/write', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('cai no padrão clássico sem valor gravado', () => {
    expect(readViewMode('user-1')).toBe(DEFAULT_VIEW_MODE)
    expect(readViewMode('user-1')).toBe('classic')
  })

  it('cai no padrão sem userId', () => {
    expect(readViewMode(null)).toBe('classic')
    expect(readViewMode(undefined)).toBe('classic')
  })

  it('grava e lê a preferência por usuário', () => {
    writeViewMode('user-1', 'shelf')
    expect(readViewMode('user-1')).toBe('shelf')
  })

  it('isola a preferência entre usuários diferentes', () => {
    writeViewMode('user-1', 'shelf')
    expect(readViewMode('user-2')).toBe('classic')
  })

  it('valor inválido gravado cai no padrão, não estoura', () => {
    window.localStorage.setItem('socialshelf:viewMode:user-1', 'qualquer-coisa')
    expect(readViewMode('user-1')).toBe('classic')
  })

  it('volta ao clássico quando regravado', () => {
    writeViewMode('user-1', 'shelf')
    writeViewMode('user-1', 'classic')
    expect(readViewMode('user-1')).toBe('classic')
  })
})
