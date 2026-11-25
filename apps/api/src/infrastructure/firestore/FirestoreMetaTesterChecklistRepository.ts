import { db } from '../firebase-admin.js'

// Documento único por usuário (singleton), mesmo padrão de subscription/credits — guarda só se o
// admin já cadastrou aquela conta como testadora do app da Meta (Instagram/Facebook), enquanto o
// app segue em modo de desenvolvimento (_local-bdr-policy-012, _local-bdr-policy-016). Não é um
// domain port: é bookkeeping puramente operacional do admin, sem significado de negócio
// substituível entre serviços (generator/publisher nunca leem isto).
const CHECKLIST_DOC_ID = 'status'

export interface MetaTesterChecklistEntry {
  userId: string
  handledAt: Date | null
}

export class FirestoreMetaTesterChecklistRepository {
  async findByUserIds(userIds: string[]): Promise<Map<string, MetaTesterChecklistEntry>> {
    const result = new Map<string, MetaTesterChecklistEntry>()
    if (userIds.length === 0) return result

    const docs = await Promise.all(
      userIds.map((userId) => db.collection('users').doc(userId).collection('meta_tester_review').doc(CHECKLIST_DOC_ID).get()),
    )

    docs.forEach((doc, index) => {
      const userId = userIds[index]!
      if (!doc.exists) return
      const data = doc.data()!
      result.set(userId, {
        userId,
        handledAt: data['handledAt'] ? new Date(data['handledAt'] as string) : null,
      })
    })

    return result
  }

  async setHandled(userId: string, handled: boolean): Promise<void> {
    await db
      .collection('users')
      .doc(userId)
      .collection('meta_tester_review')
      .doc(CHECKLIST_DOC_ID)
      .set({ handledAt: handled ? new Date().toISOString() : null })
  }
}
