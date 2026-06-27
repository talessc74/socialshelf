import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HandleLinkedInPageCallbackUseCase } from './HandleLinkedInPageCallbackUseCase.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

const mockExchange = vi.fn()
const mockListOrgs = vi.fn()

vi.mock('../../lib/linkedin-page-client.js', () => ({
  exchangeCodeForPageToken: (...args: unknown[]) => mockExchange(...args),
  listAdministeredOrganizations: (...args: unknown[]) => mockListOrgs(...args),
}))

describe('HandleLinkedInPageCallbackUseCase', () => {
  let useCase: HandleLinkedInPageCallbackUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['LINKEDIN_PAGE_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin-page/callback'

    mockExchange.mockResolvedValue({
      access_token: 'page-access-token-xyz',
      expires_in: 5183944,
      scope: 'r_organization_admin w_organization_social',
    })

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

    useCase = new HandleLinkedInPageCallbackUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('throws when the user administers no organizations', async () => {
    mockListOrgs.mockResolvedValue([])

    await expect(useCase.execute('code', 'user-1', 'brand-1')).rejects.toThrow(
      'linkedin_no_organizations',
    )
  })

  it('auto-selects and persists the connection when there is exactly one organization', async () => {
    mockListOrgs.mockResolvedValue([{ urn: 'urn:li:organization:111', name: 'Acme' }])

    const result = await useCase.execute('code', 'user-1', 'brand-1')

    expect(result.status).toBe('connected')
    if (result.status !== 'connected') throw new Error('unreachable')
    expect(result.connection.organizationUrn).toBe('urn:li:organization:111')
    expect(result.connection.platform).toBe(Platform.LINKEDIN)
    expect(mockOAuthRepo.save).toHaveBeenCalledWith(result.connection)

    const expectedPairwiseId = derivePairwiseId('user-1', Platform.LINKEDIN)
    expect(mockTokenVault.store).toHaveBeenCalledWith(
      `oauth-token-${expectedPairwiseId}`,
      expect.stringContaining('page-access-token-xyz'),
    )
  })

  it('stores a pending selection and returns the organization list when there are multiple organizations', async () => {
    const organizations = [
      { urn: 'urn:li:organization:111', name: 'Acme' },
      { urn: 'urn:li:organization:222', name: 'Acme Labs' },
    ]
    mockListOrgs.mockResolvedValue(organizations)

    const result = await useCase.execute('code', 'user-1', 'brand-1')

    expect(result.status).toBe('pending')
    if (result.status !== 'pending') throw new Error('unreachable')
    expect(result.organizations).toEqual(organizations)
    expect(result.pendingId).toBeTruthy()
    expect(mockOAuthRepo.save).not.toHaveBeenCalled()
    expect(mockTokenVault.store).toHaveBeenCalledWith(
      `linkedin-page-pending-${result.pendingId}`,
      expect.stringContaining('user-1'),
    )
  })
})
