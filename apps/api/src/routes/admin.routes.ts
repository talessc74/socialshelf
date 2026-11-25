import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GetAdminAiUsageSummaryUseCase } from '../use-cases/admin/GetAdminAiUsageSummaryUseCase.js'
import { GetAdminSignupsUseCase } from '../use-cases/admin/GetAdminSignupsUseCase.js'
import { MarkSignupHandledUseCase } from '../use-cases/admin/MarkSignupHandledUseCase.js'
import { FirestoreAiUsageReaderRepository } from '../infrastructure/firestore/FirestoreAiUsageReaderRepository.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'
import { FirestoreMetaTesterChecklistRepository } from '../infrastructure/firestore/FirestoreMetaTesterChecklistRepository.js'
import { adminAuth } from '../infrastructure/firebase-admin.js'

const markHandledSchema = z.object({ handled: z.boolean() })

// Rotas visíveis só para quem está na allowlist de admin (isAdminEmail, @socialshelf/domain) —
// enxergam dados de TODAS as contas, então o gate real é o preHandler requireAdmin no backend,
// não a UI escondida em apps/web (_local-edr-policy-072).
export async function adminRoutes(app: FastifyInstance) {
  const aiUsageReader = new FirestoreAiUsageReaderRepository()
  const brandRepo = new FirestoreBrandRepository()
  const checklistRepo = new FirestoreMetaTesterChecklistRepository()
  const getAiUsageSummary = new GetAdminAiUsageSummaryUseCase(aiUsageReader, brandRepo)
  const getSignups = new GetAdminSignupsUseCase(brandRepo, checklistRepo, adminAuth)
  const markSignupHandled = new MarkSignupHandledUseCase(checklistRepo)

  app.get(
    '/admin/ai-usage',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (_request, reply) => {
      const summary = await getAiUsageSummary.execute()
      return reply.send(summary)
    },
  )

  // Substitui notificação por e-mail/Slack (nenhuma infra desse tipo existe hoje) — lista os
  // usuários cadastrados e se já foram liberados manualmente como testadores do app da Meta
  // (_local-bdr-policy-016), pra o admin conferir quando quiser.
  app.get(
    '/admin/signups',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (_request, reply) => {
      const summary = await getSignups.execute()
      return reply.send(summary)
    },
  )

  app.post(
    '/admin/signups/:userId/handled',
    { preHandler: [app.authenticate, app.requireAdmin] },
    async (request, reply) => {
      const { userId } = request.params as { userId: string }
      const parsed = markHandledSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_body' })
      }

      await markSignupHandled.execute(userId, parsed.data.handled)
      return reply.status(204).send()
    },
  )
}
