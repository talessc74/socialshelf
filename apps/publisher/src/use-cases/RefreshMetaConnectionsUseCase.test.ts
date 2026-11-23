import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RefreshMetaConnectionsUseCase } from './RefreshMetaConnectionsUseCase.js'
import { Platform } from '@socialshelf/domain'
import type { OAuthConnection, OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

function makeConnection(overrides: Partial<OAuthConnection> = {}): OAuthConnection {
  return {
    id: 'conn-1',
    userId: 'user-1',
    brandId: 'brand-1',
    platform: Platform.FACEBOOK,
    pairwiseId: 'pairwise-fb',
    tokenRef: 'oauth-token-pairwise-fb',
    scopes: [],
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeOAuthRepo(connections: OAuthConnection[]): OAuthRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByPairwise: vi.fn(),
    findByBrandAndPlatform: vi.fn(),
    findByBrand: vi.fn(),
    findAllByPlatforms: vi.fn().mockResolvedValue(connections),
    delete: vi.fn(),
  }
}

describe('RefreshMetaConnectionsUseCase', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let tokenVault: TokenVaultPort

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    process.env['META_APP_ID'] = 'meta-app-id'
    process.env['META_APP_SECRET'] = 'meta-app-secret'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env['META_APP_ID']
    delete process.env['META_APP_SECRET']
  })

  it('skips connections that are not close to expiring', async () => {
    const connection = makeConnection({ expiresAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000) })
    const oauthRepo = makeOAuthRepo([connection])
    tokenVault = { store: vi.fn(), retrieve: vi.fn(), delete: vi.fn() }

    const result = await new RefreshMetaConnectionsUseCase(oauthRepo, tokenVault).execute()

    expect(result).toEqual({ checked: 0, refreshed: 0, failed: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes a Facebook Page connection expiring soon (re-exchange user token + re-fetch pages)', async () => {
    const connection = makeConnection({ platform: Platform.FACEBOOK })
    const oauthRepo = makeOAuthRepo([connection])
    tokenVault = {
      store: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(
        JSON.stringify({
          user_access_token: 'old-user-token',
          page_access_token: 'old-page-token',
          page_id: 'page-999',
          page_name: 'Test Page',
          expires_at: new Date().toISOString(),
        }),
      ),
      delete: vi.fn(),
    }

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-user-token', token_type: 'bearer', expires_in: 5184000 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'page-999', name: 'Test Page', access_token: 'new-page-token' }] }),
      })

    const result = await new RefreshMetaConnectionsUseCase(oauthRepo, tokenVault).execute()

    expect(result.checked).toBe(1)
    expect(result.refreshed).toBe(1)
    expect(result.failed).toEqual([])

    const stored = JSON.parse(vi.mocked(tokenVault.store).mock.calls[0]![1] as string)
    expect(stored.user_access_token).toBe('new-user-token')
    expect(stored.page_access_token).toBe('new-page-token')
    expect(stored.page_id).toBe('page-999')

    expect(vi.mocked(oauthRepo.save)).toHaveBeenCalledTimes(1)
    const saved = vi.mocked(oauthRepo.save).mock.calls[0]![0]
    expect(saved.id).toBe(connection.id)
    expect(saved.expiresAt!.getTime()).toBeGreaterThan(Date.now())
  })

  it('refreshes an Instagram-via-Facebook connection using the same page lookup', async () => {
    const connection = makeConnection({ platform: Platform.INSTAGRAM, tokenRef: 'oauth-token-pairwise-ig' })
    const oauthRepo = makeOAuthRepo([connection])
    tokenVault = {
      store: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(
        JSON.stringify({
          user_access_token: 'old-user-token',
          page_access_token: 'old-page-token',
          instagram_business_account_id: 'ig-biz-777',
          page_id: 'page-999',
          expires_at: new Date().toISOString(),
        }),
      ),
      delete: vi.fn(),
    }

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-user-token', token_type: 'bearer', expires_in: 5184000 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'page-999', name: 'Test Page', access_token: 'new-page-token', instagram_business_account: { id: 'ig-biz-777' } }],
        }),
      })

    const result = await new RefreshMetaConnectionsUseCase(oauthRepo, tokenVault).execute()

    expect(result.refreshed).toBe(1)
    const stored = JSON.parse(vi.mocked(tokenVault.store).mock.calls[0]![1] as string)
    expect(stored.page_access_token).toBe('new-page-token')
    expect(stored.instagram_business_account_id).toBe('ig-biz-777')
  })

  it('refreshes an Instagram Login connection via ig_refresh_token', async () => {
    const connection = makeConnection({ platform: Platform.INSTAGRAM, tokenRef: 'oauth-token-pairwise-ig' })
    const oauthRepo = makeOAuthRepo([connection])
    tokenVault = {
      store: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(
        JSON.stringify({
          auth_kind: 'instagram_login',
          access_token: 'old-ig-token',
          instagram_user_id: '17841400',
          username: 'eaijuridico',
          expires_at: new Date().toISOString(),
        }),
      ),
      delete: vi.fn(),
    }

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-ig-token', expires_in: 5184000 }) })

    const result = await new RefreshMetaConnectionsUseCase(oauthRepo, tokenVault).execute()

    expect(result.refreshed).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toContain('ig_refresh_token')
    const stored = JSON.parse(vi.mocked(tokenVault.store).mock.calls[0]![1] as string)
    expect(stored.access_token).toBe('new-ig-token')
    expect(stored.auth_kind).toBe('instagram_login')
    expect(stored.username).toBe('eaijuridico')
  })

  it('records a failure and continues with the remaining connections when a refresh call fails', async () => {
    const broken = makeConnection({ id: 'conn-broken', tokenRef: 'oauth-token-broken' })
    const healthy = makeConnection({
      id: 'conn-healthy',
      tokenRef: 'oauth-token-healthy',
      platform: Platform.INSTAGRAM,
    })
    const oauthRepo = makeOAuthRepo([broken, healthy])

    const retrieve = vi.fn().mockImplementation((ref: string) => {
      if (ref === 'oauth-token-broken') {
        return Promise.resolve(
          JSON.stringify({ auth_kind: 'instagram_login', access_token: 'dead-token', instagram_user_id: '1' }),
        )
      }
      return Promise.resolve(
        JSON.stringify({ auth_kind: 'instagram_login', access_token: 'live-token', instagram_user_id: '2' }),
      )
    })
    tokenVault = { store: vi.fn(), retrieve, delete: vi.fn() }

    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'invalid_grant: token expired' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-token', expires_in: 5184000 }) })

    const result = await new RefreshMetaConnectionsUseCase(oauthRepo, tokenVault).execute()

    expect(result.checked).toBe(2)
    expect(result.refreshed).toBe(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]!.connectionId).toBe('conn-broken')
    expect(result.failed[0]!.message).toContain('400')
  })

  it('fails the connection when the Page is no longer among the pages the user manages', async () => {
    const connection = makeConnection()
    const oauthRepo = makeOAuthRepo([connection])
    tokenVault = {
      store: vi.fn(),
      retrieve: vi.fn().mockResolvedValue(
        JSON.stringify({ user_access_token: 'old-token', page_access_token: 'old-page-token', page_id: 'page-missing' }),
      ),
      delete: vi.fn(),
    }

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-user-token', expires_in: 5184000 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })

    const result = await new RefreshMetaConnectionsUseCase(oauthRepo, tokenVault).execute()

    expect(result.refreshed).toBe(0)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]!.message).toContain('page-missing')
  })
})
