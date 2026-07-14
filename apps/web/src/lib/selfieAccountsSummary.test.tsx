import { describe, it, expect } from 'vitest'
import { buildAccountsMessage } from './selfieAccountsSummary'
import { Platform } from '@socialshelf/domain'
import type { ApiConnection } from './api'

function makeConnection(platform: Platform): ApiConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: 'pairwise-1',
    tokenRef: 'token-ref',
    scopes: [],
    expiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('buildAccountsMessage', () => {
  it('avisa quando nenhuma rede está conectada', () => {
    expect(buildAccountsMessage([])).toContain('não conectou nenhuma')
  })

  it('conta redes distintas conectadas', () => {
    const message = buildAccountsMessage([makeConnection(Platform.LINKEDIN), makeConnection(Platform.INSTAGRAM)])
    expect(message).toContain('2 de 5')
  })

  it('não conta a mesma plataforma duas vezes', () => {
    const message = buildAccountsMessage([makeConnection(Platform.LINKEDIN), makeConnection(Platform.LINKEDIN)])
    expect(message).toContain('1 de 5')
  })

  it('comemora quando todas as redes estão conectadas', () => {
    const all = [
      Platform.LINKEDIN,
      Platform.FACEBOOK,
      Platform.INSTAGRAM,
      Platform.TWITTER,
      Platform.TIKTOK,
    ].map(makeConnection)
    expect(buildAccountsMessage(all)).toContain('todas as 5')
  })
})
