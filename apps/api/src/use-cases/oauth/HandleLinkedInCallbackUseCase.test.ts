import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HandleLinkedInCallbackUseCase } from './HandleLinkedInCallbackUseCase.js'
import { listAdministeredOrganizations } from '../../lib/linkedin-client.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

vi.mock('../../lib/linkedin-client.js', () => ({
  exchangeCodeForToken: vi.fn().mockResolvedValue({
    access_token: 'linkedin-access-token-xyz',
    expires_in: 5183944,
    scope: 'openid profile email w_member_social',
  }),
  listAdministeredOrganizations: vi.fn().mockResolvedValue([]),
}))

describe('HandleLinkedInCallbackUseCase', () => {
  let useCase: HandleLinkedInCallbackUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin/callback'

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

    useCase = new HandleLinkedInCallbackUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('saves OAuth connection with correct platform, userId and brandId', async () => {
    const connection = await useCase.execute('auth-code', 'user-123', 'brand-456')

    expect(connection.platform).toBe(Platform.LINKEDIN)
    expect(connection.userId).toBe('user-123')
    expect(connection.brandId).toBe('brand-456')
    expect(mockOAuthRepo.save).toHaveBeenCalledWith(connection)
  })

  it('stores encrypted token in vault with pairwise ref', async () => {
    const connection = await useCase.execute('auth-code', 'user-123', 'brand-456')

    expect(mockTokenVault.store).toHaveBeenCalledWith(
      `oauth-token-${connection.pairwiseId}`,
      expect.stringContaining('linkedin-access-token-xyz'),
    )
  })

  it('derives pairwise ID from userId and platform', async () => {
    const connection = await useCase.execute('auth-code', 'user-123', 'brand-456')

    const expectedPairwiseId = derivePairwiseId('user-123', Platform.LINKEDIN)
    expect(connection.pairwiseId).toBe(expectedPairwiseId)
    expect(connection.tokenRef).toBe(`oauth-token-${expectedPairwiseId}`)
  })

  it('includes correct scopes from token response', async () => {
    const connection = await useCase.execute('auth-code', 'user-123', 'brand-456')

    expect(connection.scopes).toContain('w_member_social')
    expect(connection.scopes).toContain('openid')
  })

  it('assigns a unique ID to each connection', async () => {
    const c1 = await useCase.execute('code-1', 'user-123', 'brand-456')
    const c2 = await useCase.execute('code-2', 'user-123', 'brand-456')
    expect(c1.id).not.toBe(c2.id)
  })

  it('leaves organizationUrn null when user administers no organizations', async () => {
    const connection = await useCase.execute('auth-code', 'user-123', 'brand-456')
    expect(connection.organizationUrn).toBeNull()
  })

  it('auto-selects the organization when exactly one is administered', async () => {
    vi.mocked(listAdministeredOrganizations).mockResolvedValueOnce([
      { urn: 'urn:li:organization:555', name: 'EAI? Simulação Jurídica' },
    ])

    const connection = await useCase.execute('auth-code', 'user-123', 'brand-456')

    expect(connection.organizationUrn).toBe('urn:li:organization:555')
  })

  it('throws when user administers more than one organization', async () => {
    vi.mocked(listAdministeredOrganizations).mockResolvedValueOnce([
      { urn: 'urn:li:organization:555', name: 'Empresa A' },
      { urn: 'urn:li:organization:666', name: 'Empresa B' },
    ])

    await expect(useCase.execute('auth-code', 'user-123', 'brand-456')).rejects.toThrow(
      'linkedin_multiple_organizations',
    )
  })
})
