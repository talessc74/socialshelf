import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HandleXCallbackUseCase } from './HandleXCallbackUseCase.js'
import { generateState } from '../../lib/csrf.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

vi.mock('../../lib/x-client.js', () => ({
  exchangeCodeForXToken: vi.fn().mockResolvedValue({
    access_token: 'x-access-token-abc',
    refresh_token: 'x-refresh-token-xyz',
    expires_in: 7200,
    scope: 'tweet.read tweet.write users.read offline.access',
    token_type: 'bearer',
  }),
}))

describe('HandleXCallbackUseCase', () => {
  let useCase: HandleXCallbackUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['X_CLIENT_ID'] = 'test-x-client-id'
    process.env['X_CLIENT_SECRET'] = 'test-x-client-secret'
    process.env['X_REDIRECT_URI'] = 'http://localhost:3001/oauth/x/callback'

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

    useCase = new HandleXCallbackUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('returns an OAuthConnection with TWITTER platform', async () => {
    const state = generateState('user-123')
    const result = await useCase.execute('x-code', state, 'verifier-abc', 'brand-456')

    expect(result.platform).toBe(Platform.TWITTER)
    expect(result.userId).toBe('user-123')
    expect(result.brandId).toBe('brand-456')
  })

  it('derives correct pairwise ID for Twitter', async () => {
    const state = generateState('user-123')
    const result = await useCase.execute('x-code', state, 'verifier-abc', 'brand-456')

    expect(result.pairwiseId).toBe(derivePairwiseId('user-123', Platform.TWITTER))
  })

  it('stores access and refresh tokens in vault', async () => {
    const state = generateState('user-123')
    await useCase.execute('x-code', state, 'verifier-abc', 'brand-456')

    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.stringContaining('oauth-token-'),
      expect.stringContaining('x-access-token-abc'),
    )
    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.stringContaining('oauth-token-'),
      expect.stringContaining('x-refresh-token-xyz'),
    )
  })

  it('saves the connection to the repository', async () => {
    const state = generateState('user-123')
    await useCase.execute('x-code', state, 'verifier-abc', 'brand-456')

    expect(mockOAuthRepo.save).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(mockOAuthRepo.save).mock.calls[0]![0]
    expect(saved.userId).toBe('user-123')
    expect(saved.brandId).toBe('brand-456')
    expect(saved.platform).toBe(Platform.TWITTER)
  })

  it('parses scopes from space-separated string', async () => {
    const state = generateState('user-123')
    const result = await useCase.execute('x-code', state, 'verifier-abc', 'brand-456')

    expect(result.scopes).toEqual(['tweet.read', 'tweet.write', 'users.read', 'offline.access'])
  })

  it('passes codeVerifier to token exchange', async () => {
    const { exchangeCodeForXToken } = await import('../../lib/x-client.js')
    const state = generateState('user-123')
    await useCase.execute('x-code', state, 'my-verifier', 'brand-456')

    expect(vi.mocked(exchangeCodeForXToken)).toHaveBeenCalledWith('x-code', 'my-verifier')
  })

  it('throws on invalid state', async () => {
    await expect(
      useCase.execute('x-code', 'invalid.tampered', 'verifier-abc', 'brand-456'),
    ).rejects.toThrow()
  })
})
