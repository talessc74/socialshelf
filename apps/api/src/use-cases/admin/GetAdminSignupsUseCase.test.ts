import { describe, it, expect, vi } from 'vitest'
import { GetAdminSignupsUseCase } from './GetAdminSignupsUseCase.js'
import type { BrandRepository } from '@socialshelf/domain'
import type { FirestoreMetaTesterChecklistRepository } from '../../infrastructure/firestore/FirestoreMetaTesterChecklistRepository.js'
import type { Auth } from 'firebase-admin/auth'

function makeBrand(userId: string, createdAt: string) {
  return {
    id: `brand-${userId}`,
    userId,
    name: userId,
    slug: userId,
    platforms: [],
    accountType: 'personal' as const,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  }
}

describe('GetAdminSignupsUseCase', () => {
  it('usa a marca mais antiga de cada usuário como data de cadastro', async () => {
    const brandRepo: BrandRepository = {
      findAll: vi.fn().mockResolvedValue([makeBrand('user-1', '2026-11-20T10:00:00Z'), makeBrand('user-1', '2026-11-22T10:00:00Z')]),
      save: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      delete: vi.fn(),
    }
    const checklistRepo = {
      findByUserIds: vi.fn().mockResolvedValue(new Map()),
      setHandled: vi.fn(),
    } as unknown as FirestoreMetaTesterChecklistRepository
    const auth = { getUsers: vi.fn().mockResolvedValue({ users: [{ uid: 'user-1', email: 'u1@exemplo.com' }], notFound: [] }) } as unknown as Auth

    const useCase = new GetAdminSignupsUseCase(brandRepo, checklistRepo, auth)
    const result = await useCase.execute()

    expect(result.signups).toEqual([
      { userId: 'user-1', email: 'u1@exemplo.com', signedUpAt: '2026-11-20T10:00:00.000Z', metaTesterHandled: false },
    ])
  })

  it('devolve email null quando o Firebase Auth não encontra o usuário', async () => {
    const brandRepo: BrandRepository = {
      findAll: vi.fn().mockResolvedValue([makeBrand('user-1', '2026-11-20T10:00:00Z')]),
      save: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      delete: vi.fn(),
    }
    const checklistRepo = {
      findByUserIds: vi.fn().mockResolvedValue(new Map()),
      setHandled: vi.fn(),
    } as unknown as FirestoreMetaTesterChecklistRepository
    const auth = { getUsers: vi.fn().mockResolvedValue({ users: [], notFound: [{ uid: 'user-1' }] }) } as unknown as Auth

    const useCase = new GetAdminSignupsUseCase(brandRepo, checklistRepo, auth)
    const result = await useCase.execute()

    expect(result.signups[0]?.email).toBeNull()
  })

  it('não chama o Firebase Auth nem o checklist quando não há marcas', async () => {
    const brandRepo: BrandRepository = {
      findAll: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      delete: vi.fn(),
    }
    const findByUserIds = vi.fn()
    const checklistRepo = { findByUserIds, setHandled: vi.fn() } as unknown as FirestoreMetaTesterChecklistRepository
    const getUsers = vi.fn()
    const auth = { getUsers } as unknown as Auth

    const useCase = new GetAdminSignupsUseCase(brandRepo, checklistRepo, auth)
    const result = await useCase.execute()

    expect(result.signups).toEqual([])
    expect(getUsers).not.toHaveBeenCalled()
  })
})
