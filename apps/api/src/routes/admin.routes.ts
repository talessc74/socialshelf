import type { FastifyInstance } from 'fastify'
import { GetAdminAiUsageSummaryUseCase } from '../use-cases/admin/GetAdminAiUsageSummaryUseCase.js'
import { FirestoreAiUsageReaderRepository } from '../infrastructure/firestore/FirestoreAiUsageReaderRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'

// Rotas visíveis só para quem está na allowlist de admin (isAdminEmail, @socialshelf/domain) —
// enxergam dados de TODAS as contas, então o gate real é o preHandler requireAdmin no backend,
// não a UI escondida em apps/web (_local-edr-policy-072).
export async function adminRoutes(app: FastifyInstance) {
  const aiUsageReader = new FirestoreAiUsageReaderRepository()
  const brandRepo = new FirestoreBrandRepository()
  const getAiUsageSummary = new GetAdminAiUsageSummaryUseCase(aiUsageReader, brandRepo)

  app.get(
    '/admin/ai-usage',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (_request, reply) => {
      const summary = await getAiUsageSummary.execute()
      return reply.send(summary)
    },
  )
}
