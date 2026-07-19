import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HandleInstagramCallbackUseCase } from './HandleInstagramCallbackUseCase.js'
import { generateState } from '../../lib/csrf.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

vi.mock('../../lib/instagram-client.js', () => ({
  exchangeCodeForInstagramToken: vi.fn().mockResolvedValue({
    access_token: 'ig-short-token',
    user_id: 17841400000000000,
  }),
  exchangeForLongLivedInstagramToken: vi.fn().mockResolvedValue({
    access_token: 'ig-long-token',
    token_type: 'bearer',
    expires_in: 5184000,
  }),
  getInstagramProfile: vi.fn().mockResolvedValue({
    user_id: 17841400000000000,
    username: 'radiokactus',
  }),
}))

describe('HandleInstagramCallbackUseCase', () => {
  let useCase: HandleInstagramCallbackUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['INSTAGRAM_REDIRECT_URI'] = 'http://localhost:3001/oauth/instagram/callback'

    mockOAuthRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByPairwise: vi.fn(),
      findByBrandAndPlatform: vi.fn(),
      findByBrand: vi.fn(),
      delete: vi.fn(),
    }

    mockTokenVault = {
      store: vi.fn().mockResolvedValue(undefined),
      retrieve: vi.fn(),
      delete: vi.fn(),
    }

    useCase = new HandleInstagramCallbackUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('creates an Instagram connection without any Facebook involvement', async () => {
    const state = generateState('user-123', 'brand-456')
    const connection = await useCase.execute('ig-code', state, 'brand-456')

    expect(connection.platform).toBe(Platform.INSTAGRAM)
    expect(connection.userId).toBe('user-123')
    expect(connection.brandId).toBe('brand-456')
    expect(connection.pairwiseId).toBe(derivePairwiseId('user-123', Platform.INSTAGRAM))
    expect(mockOAuthRepo.save).toHaveBeenCalledTimes(1)
  })

  it('labels the connection with the @username for the Central de Contas', async () => {
    const state = generateState('user-123', 'brand-456')
    const connection = await useCase.execute('ig-code', state, 'brand-456')

    expect(connection.accountLabel).toBe('@radiokactus')
  })

  it('stores the token in the vault marked as instagram_login with the IG user id', async () => {
    const state = generateState('user-123', 'brand-456')
    await useCase.execute('ig-code', state, 'brand-456')

    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.stringContaining('oauth-token-'),
      expect.stringContaining('"auth_kind":"instagram_login"'),
    )
    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('"instagram_user_id":"17841400000000000"'),
    )
    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('ig-long-token'),
    )
  })

  it('records the Instagram Login business scopes on the connection', async () => {
    const state = generateState('user-123', 'brand-456')
    const connection = await useCase.execute('ig-code', state, 'brand-456')

    expect(connection.scopes).toContain('instagram_business_basic')
    expect(connection.scopes).toContain('instagram_business_content_publish')
  })

  it('falls back to a 60-day expiry when expires_in is missing', async () => {
    const { exchangeForLongLivedInstagramToken } = await import('../../lib/instagram-client.js')
    vi.mocked(exchangeForLongLivedInstagramToken).mockResolvedValueOnce({
      access_token: 'ig-long-token-no-expiry',
      token_type: 'bearer',
    })

    const state = generateState('user-123', 'brand-456')
    const connection = await useCase.execute('ig-code', state, 'brand-456')

    expect(connection.expiresAt).toBeInstanceOf(Date)
    expect(Number.isNaN(connection.expiresAt!.getTime())).toBe(false)
  })

  it('falls back to a 60-day expiry when expires_in is implausible', async () => {
    const { exchangeForLongLivedInstagramToken } = await import('../../lib/instagram-client.js')
    vi.mocked(exchangeForLongLivedInstagramToken).mockResolvedValueOnce({
      access_token: 'ig-long-token-weird-expiry',
      token_type: 'bearer',
      expires_in: Number.MAX_SAFE_INTEGER,
    })

    const state = generateState('user-123', 'brand-456')
    const connection = await useCase.execute('ig-code', state, 'brand-456')

    expect(connection.expiresAt).toBeInstanceOf(Date)
    expect(Number.isNaN(connection.expiresAt!.getTime())).toBe(false)
  })

  it('throws on invalid state', async () => {
    await expect(useCase.execute('ig-code', 'invalid.tampered', 'brand-456')).rejects.toThrow()
    expect(mockOAuthRepo.save).not.toHaveBeenCalled()
  })
})
