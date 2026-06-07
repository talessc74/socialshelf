import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HandleMetaCallbackUseCase } from './HandleMetaCallbackUseCase.js'
import { generateState } from '../../lib/csrf.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

vi.mock('../../lib/meta-client.js', () => ({
  exchangeCodeForShortLivedToken: vi.fn().mockResolvedValue({
    access_token: 'short-lived-token',
    token_type: 'bearer',
  }),
  exchangeShortForLongLived: vi.fn().mockResolvedValue({
    access_token: 'long-lived-token-60days',
    token_type: 'bearer',
    expires_in: 5184000,
  }),
  getUserPages: vi.fn().mockResolvedValue([
    {
      id: 'page-111',
      name: 'Rádio Kactus',
      access_token: 'page-access-token-xxx',
      instagram_business_account: { id: 'ig-biz-222' },
    },
  ]),
}))

describe('HandleMetaCallbackUseCase', () => {
  let useCase: HandleMetaCallbackUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['META_REDIRECT_URI'] = 'http://localhost:3001/oauth/meta/callback'

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

    useCase = new HandleMetaCallbackUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('returns both Facebook and Instagram connections when page has Instagram linked', async () => {
    const state = generateState('user-123')
    const result = await useCase.execute('meta-code', state, 'brand-456')

    expect(result.facebook).not.toBeNull()
    expect(result.instagram).not.toBeNull()
    expect(result.facebook!.platform).toBe(Platform.FACEBOOK)
    expect(result.instagram!.platform).toBe(Platform.INSTAGRAM)
  })

  it('returns null Instagram when page has no Instagram Business Account', async () => {
    const { getUserPages } = await import('../../lib/meta-client.js')
    vi.mocked(getUserPages).mockResolvedValueOnce([
      { id: 'page-111', name: 'Page', access_token: 'token' },
    ])

    const state = generateState('user-123')
    const result = await useCase.execute('meta-code', state, 'brand-456')

    expect(result.facebook).not.toBeNull()
    expect(result.instagram).toBeNull()
  })

  it('returns null for both when user has no pages', async () => {
    const { getUserPages } = await import('../../lib/meta-client.js')
    vi.mocked(getUserPages).mockResolvedValueOnce([])

    const state = generateState('user-123')
    const result = await useCase.execute('meta-code', state, 'brand-456')

    expect(result.facebook).toBeNull()
    expect(result.instagram).toBeNull()
  })

  it('derives correct pairwise IDs for each platform', async () => {
    const state = generateState('user-123')
    const result = await useCase.execute('meta-code', state, 'brand-456')

    expect(result.facebook!.pairwiseId).toBe(derivePairwiseId('user-123', Platform.FACEBOOK))
    expect(result.instagram!.pairwiseId).toBe(derivePairwiseId('user-123', Platform.INSTAGRAM))
  })

  it('stores page access token and Instagram account ID in vault', async () => {
    const state = generateState('user-123')
    await useCase.execute('meta-code', state, 'brand-456')

    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.stringContaining('oauth-token-'),
      expect.stringContaining('page-access-token-xxx'),
    )
    expect(mockTokenVault.store).toHaveBeenCalledWith(
      expect.stringContaining('oauth-token-'),
      expect.stringContaining('ig-biz-222'),
    )
  })

  it('exchanges short-lived token for long-lived before saving', async () => {
    const { exchangeShortForLongLived } = await import('../../lib/meta-client.js')
    const state = generateState('user-123')
    await useCase.execute('meta-code', state, 'brand-456')

    expect(vi.mocked(exchangeShortForLongLived)).toHaveBeenCalledWith('short-lived-token')
  })

  it('saves both connections with correct userId and brandId', async () => {
    const state = generateState('user-123')
    await useCase.execute('meta-code', state, 'brand-456')

    expect(mockOAuthRepo.save).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(mockOAuthRepo.save).mock.calls
    expect(calls[0]![0].userId).toBe('user-123')
    expect(calls[0]![0].brandId).toBe('brand-456')
    expect(calls[1]![0].userId).toBe('user-123')
    expect(calls[1]![0].brandId).toBe('brand-456')
  })

  it('throws on invalid state', async () => {
    await expect(
      useCase.execute('meta-code', 'invalid.tampered', 'brand-456'),
    ).rejects.toThrow()
  })
})
