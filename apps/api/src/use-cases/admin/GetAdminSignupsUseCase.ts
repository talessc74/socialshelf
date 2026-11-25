import type { Auth } from 'firebase-admin/auth'
import type { BrandRepository } from '@socialshelf/domain'
import type { FirestoreMetaTesterChecklistRepository } from '../../infrastructure/firestore/FirestoreMetaTesterChecklistRepository.js'

export interface AdminSignupEntry {
  userId: string
  email: string | null
  signedUpAt: string
  metaTesterHandled: boolean
}

export interface AdminSignupsSummary {
  signups: AdminSignupEntry[]
}

// Lista usuários pela data da marca mais antiga que cada um tem (aproximação de "data de
// cadastro" — todo usuário ganha uma marca default no primeiro login, _local-adr-policy-0NN),
// cruzado com o e-mail real (Firebase Auth) e com o checklist de liberação manual como
// testador do app da Meta (_local-bdr-policy-016). Substitui notificação por e-mail/Slack: o
// admin confere esta lista quando quiser, sem depender de infraestrutura nova.
export class GetAdminSignupsUseCase {
  constructor(
    private readonly brandRepo: BrandRepository,
    private readonly checklistRepo: FirestoreMetaTesterChecklistRepository,
    private readonly auth: Auth,
  ) {}

  async execute(): Promise<AdminSignupsSummary> {
    const brands = await this.brandRepo.findAll()

    const earliestByUser = new Map<string, Date>()
    for (const brand of brands) {
      const current = earliestByUser.get(brand.userId)
      if (!current || brand.createdAt < current) {
        earliestByUser.set(brand.userId, brand.createdAt)
      }
    }

    const userIds = [...earliestByUser.keys()]
    const [checklist, emailsByUserId] = await Promise.all([
      this.checklistRepo.findByUserIds(userIds),
      this.lookupEmails(userIds),
    ])

    const signups: AdminSignupEntry[] = userIds.map((userId) => ({
      userId,
      email: emailsByUserId.get(userId) ?? null,
      signedUpAt: earliestByUser.get(userId)!.toISOString(),
      metaTesterHandled: checklist.get(userId)?.handledAt != null,
    }))

    signups.sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt))

    return { signups }
  }

  private async lookupEmails(userIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (userIds.length === 0) return result

    const { users } = await this.auth.getUsers(userIds.map((uid) => ({ uid })))
    for (const user of users) {
      if (user.email) result.set(user.uid, user.email)
    }
    return result
  }
}
