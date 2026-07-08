import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HandleTikTokCallbackUseCase } from './HandleTikTokCallbackUseCase.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

vi.mock('../../lib/tiktok-client.js', () => ({
  exchangeCodeForTikTokToken: vi.fn().mockResolvedValue({
    access_token: 'tiktok-access-token-abc',
    refresh_token: 'tiktok-refresh-token-xyz',
    expires_in: 86400,
    refresh_expires_in: 31536000,
    open_id: 'tiktok-open-id-123',
    scope: 'user.info.basic,video.publish',
    token_type: 'Bearer',
  }),
}))

describe('HandleTikTokCallbackUseCase', () => {
  let useCase: HandleTikTokCallbackUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  beforeEach(() => {
    process.env['TIKTOK_CLIENT_KEY'] = 'test-tiktok-client-key'
    process.env['TIKTOK_CLIENT_SECRET'] = 'test-tiktok-client-secret'
    process.env['TIKTOK_REDIRECT_URI'] = 'http://localhost:3001/oauth/tiktok/callback'

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

    useCase = new HandleTikTokCallbackUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('returns an OAuthConnection with TIKTOK platform', async () => {
    const result = await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    expect(result.platform).toBe(Platform.TIKTOK)
    expect(result.userId).toBe('user-123')
    expect(result.brandId).toBe('brand-456')
  })

  it('derives pairwise ID the same deterministic way as other platforms (never the TikTok open_id)', async () => {
    const result = await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    expect(result.pairwiseId).toBe(derivePairwiseId('user-123', Platform.TIKTOK))
    expect(result.pairwiseId).not.toBe('tiktok-open-id-123')
  })

  it('stores access token, refresh token and open_id in vault', async () => {
    await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.stringContaining('oauth-token-'),
      expect.stringContaining('tiktok-access-token-abc'),
    )
    const storedPayload = vi.mocked(mockTokenVault.store).mock.calls[0]![1]
    expect(storedPayload).toContain('tiktok-refresh-token-xyz')
    expect(storedPayload).toContain('tiktok-open-id-123')
  })

  it('never persists a union_id anywhere, even if present in the token response', async () => {
    await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    const storedPayload = vi.mocked(mockTokenVault.store).mock.calls[0]![1]
    expect(storedPayload).not.toContain('union_id')

    const saved = vi.mocked(mockOAuthRepo.save).mock.calls[0]![0]
    expect(JSON.stringify(saved)).not.toContain('union_id')
  })

  it('saves the connection to the repository', async () => {
    await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    expect(mockOAuthRepo.save).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(mockOAuthRepo.save).mock.calls[0]![0]
    expect(saved.userId).toBe('user-123')
    expect(saved.brandId).toBe('brand-456')
    expect(saved.platform).toBe(Platform.TIKTOK)
  })

  it('parses scopes from comma-separated string', async () => {
    const result = await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    expect(result.scopes).toEqual(['user.info.basic', 'video.publish'])
  })

  it('sets expiresAt roughly 24 hours out', async () => {
    const before = Date.now()
    const result = await useCase.execute('tt-code', 'verifier-abc', 'user-123', 'brand-456')

    expect(result.expiresAt).not.toBeNull()
    const diffMs = (result.expiresAt as Date).getTime() - before
    expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(diffMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 5000)
  })

  it('passes codeVerifier to token exchange', async () => {
    const { exchangeCodeForTikTokToken } = await import('../../lib/tiktok-client.js')
    await useCase.execute('tt-code', 'my-verifier', 'user-123', 'brand-456')

    expect(vi.mocked(exchangeCodeForTikTokToken)).toHaveBeenCalledWith('tt-code', 'my-verifier')
  })
})
