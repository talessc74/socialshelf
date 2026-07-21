import type { Platform } from './Platform.js'
import type { AccountType } from './AccountType.js'

export interface Brand {
  id: string
  userId: string
  name: string
  slug: string
  platforms: Platform[]
  // 'personal' | 'professional' (_local-bdr-policy-009). Governa como a IA escreve a copy:
  // conta pessoal fala em primeira pessoa e sem CTA; profissional cita a marca e usa CTA.
  accountType: AccountType
  createdAt: Date
  updatedAt: Date
}
