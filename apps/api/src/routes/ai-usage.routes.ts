import type { FastifyInstance } from 'fastify'
import { GetBrandAiUsageSummaryUseCase } from '../use-cases/ai-usage/GetBrandAiUsageSummaryUseCase.js'
import { FirestoreAiUsageReaderRepository } from '../infrastructure/firestore/FirestoreAiUsageReaderRepository.js'

// Gasto de IA da própria conta — qualquer usuário autenticado enxerga só a sua marca
// (findByBrand), diferente de /admin/ai-usage que exige requireAdmin (_local-edr-policy-073).
export async function aiUsageRoutes(app: FastifyInstance) {
  const aiUsageReader = new FirestoreAiUsageReaderRepository()
  const getBrandAiUsageSummary = new GetBrandAiUsageSummaryUseCase(aiUsageReader)

  app.get(
    '/ai-usage',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const summary = await getBrandAiUsageSummary.execute(request.userId, request.brandId)
      return reply.send(summary)
    },
  )
}
