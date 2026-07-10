import type { FastifyInstance } from 'fastify'
import { AutonomyTickUseCase } from '../use-cases/AutonomyTickUseCase.js'
import { FirestoreAutonomyBrandDiscovery } from '../infrastructure/firestore/FirestoreAutonomyBrandDiscovery.js'
import { FirestoreAutonomyDailyCounterRepository } from '../infrastructure/firestore/FirestoreAutonomyDailyCounterRepository.js'
import { FirestoreOAuthRepository } from '../infrastructure/firestore/FirestoreOAuthRepository.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { HttpGeneratorAutonomyClient } from '../infrastructure/generator/GeneratorAutonomyClient.js'
import type { PublishPostUseCase } from '../use-cases/PublishPostUseCase.js'

// Acionado pelo Cloud Scheduler uma vez por dia (autenticação OIDC + X-Internal-Secret,
// mesmo padrão de /internal/scheduler-tick e /internal/videos-cleanup-tick) — varre marcas
// com autonomia semi-automática/automática e gera (e, quando elegível, publica) 1 post por
// marca a partir da pauta de maior aderência do dia (_local-bdr-plan-002, Fase 4).
export async function autonomyRoutes(app: FastifyInstance, publishPostUseCase: PublishPostUseCase) {
  const internalSecret = process.env['INTERNAL_SECRET']
  const generatorUrl = process.env['GENERATOR_URL']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the publisher service')
  }
  if (!generatorUrl) {
    throw new Error('GENERATOR_URL env var is required — set it before starting the publisher service')
  }

  const useCase = new AutonomyTickUseCase(
    new FirestoreAutonomyBrandDiscovery(),
    new FirestoreAutonomyDailyCounterRepository(),
    new FirestoreOAuthRepository(),
    new FirestorePostRepository(),
    publishPostUseCase,
    new HttpGeneratorAutonomyClient(generatorUrl, internalSecret),
  )

  app.post('/internal/autonomy-tick', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const results = await useCase.execute()
    return reply.send({ results })
  })
}
