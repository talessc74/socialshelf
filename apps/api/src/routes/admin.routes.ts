import type { FastifyInstance } from 'fastify'
import { db } from '../infrastructure/firebase-admin.js'

export async function adminRoutes(app: FastifyInstance) {
  const internalSecret = process.env['INTERNAL_SECRET']

  if (!internalSecret) return

  app.post('/admin/cleanup-duplicate-connections', async (request, reply) => {
    if (request.headers['x-internal-secret'] !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const snapshot = await db.collectionGroup('oauth_connections').get()

    // Group docs by (brandId, platform) — keep newest, delete the rest
    const groups = new Map<string, Array<{ ref: FirebaseFirestore.DocumentReference; updatedAt: Date }>>()

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const key = `${data['brandId'] as string}::${data['platform'] as string}`
      const updatedAt = new Date(data['updatedAt'] as string)
      const existing = groups.get(key) ?? []
      existing.push({ ref: doc.ref, updatedAt })
      groups.set(key, existing)
    }

    const toDelete: FirebaseFirestore.DocumentReference[] = []
    for (const docs of groups.values()) {
      if (docs.length <= 1) continue
      docs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      toDelete.push(...docs.slice(1).map((d) => d.ref))
    }

    // Firestore batch deletes (max 500 per batch)
    let deleted = 0
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = db.batch()
      toDelete.slice(i, i + 500).forEach((ref) => batch.delete(ref))
      await batch.commit()
      deleted += Math.min(500, toDelete.length - i)
    }

    app.log.info({ total: snapshot.size, deleted }, 'cleanup-duplicate-connections')
    return reply.send({ total: snapshot.size, deleted, kept: snapshot.size - deleted })
  })
}
