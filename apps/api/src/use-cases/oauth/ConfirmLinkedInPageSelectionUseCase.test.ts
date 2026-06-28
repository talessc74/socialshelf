import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConfirmLinkedInPageSelectionUseCase } from './ConfirmLinkedInPageSelectionUseCase.js'
import { Platform, derivePairwiseId } from '@socialshelf/domain'
import type { OAuthRepository, TokenVaultPort } from '@socialshelf/domain'

describe('ConfirmLinkedInPageSelectionUseCase', () => {
  let useCase: ConfirmLinkedInPageSelectionUseCase
  let mockOAuthRepo: OAuthRepository
  let mockTokenVault: TokenVaultPort

  const pendingBlob = JSON.stringify({
    userId: 'user-1',
    brandId: 'brand-1',
    access_token: 'page-access-token-xyz',
    refresh_token: null,
    expires_in: 5183944,
    scope: 'r_organization_admin w_organization_social',
    organizations: [
      { urn: 'urn:li:organization:111', name: 'Acme' },
      { urn: 'urn:li:organization:222', name: 'Acme Labs' },
    ],
    iat: Date.now(),
  })

  beforeEach(() => {
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
      retrieve: vi.fn().mockResolvedValue(pendingBlob),
      delete: vi.fn().mockResolvedValue(undefined),
    }

    useCase = new ConfirmLinkedInPageSelectionUseCase(mockOAuthRepo, mockTokenVault)
  })

  it('persists the connection with the chosen organizationUrn', async () => {
    const connection = await useCase.execute('pending-1', 'user-1', 'urn:li:organization:222')

    expect(connection.organizationUrn).toBe('urn:li:organization:222')
    expect(connection.userId).toBe('user-1')
    expect(connection.brandId).toBe('brand-1')
    expect(mockOAuthRepo.save).toHaveBeenCalledWith(connection)

    const expectedPairwiseId = derivePairwiseId('user-1', Platform.LINKEDIN)
    expect(connection.pairwiseId).toBe(expectedPairwiseId)
  })

  it('deletes the pending vault entry after confirming', async () => {
    await useCase.execute('pending-1', 'user-1', 'urn:li:organization:222')
    expect(mockTokenVault.delete).toHaveBeenCalledWith('linkedin-page-pending-pending-1')
  })

  it('rejects when the requesting user does not own the pending selection', async () => {
    await expect(
      useCase.execute('pending-1', 'someone-else', 'urn:li:organization:222'),
    ).rejects.toThrow('linkedin_pending_selection_not_found')
  })

  it('rejects an organizationUrn that was not in the original list', async () => {
    await expect(
      useCase.execute('pending-1', 'user-1', 'urn:li:organization:999'),
    ).rejects.toThrow('linkedin_invalid_organization')
  })

  it('rejects an expired pending selection', async () => {
    const expiredBlob = JSON.stringify({
      userId: 'user-1',
      brandId: 'brand-1',
      access_token: 'page-access-token-xyz',
      refresh_token: null,
      expires_in: 5183944,
      scope: 'r_organization_admin w_organization_social',
      organizations: [{ urn: 'urn:li:organization:111', name: 'Acme' }],
      iat: Date.now() - 11 * 60 * 1000,
    })
    mockTokenVault.retrieve = vi.fn().mockResolvedValue(expiredBlob)

    await expect(
      useCase.execute('pending-1', 'user-1', 'urn:li:organization:111'),
    ).rejects.toThrow('linkedin_pending_selection_expired')
  })
})
