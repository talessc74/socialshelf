import type { FastifyInstance } from 'fastify'
import { CleanupPublishedPostImagesUseCase } from '../use-cases/storage/CleanupPublishedPostImagesUseCase.js'
import { CleanupCancelledCampaignPhotosUseCase } from '../use-cases/storage/CleanupCancelledCampaignPhotosUseCase.js'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import { FirestorePhotoCampaignRepository } from '../infrastructure/firestore/FirestorePhotoCampaignRepository.js'
import { FirestoreCampaignItemRepository } from '../infrastructure/firestore/FirestoreCampaignItemRepository.js'
import { FirestoreCampaignPhotoRepository } from '../infrastructure/firestore/FirestoreCampaignPhotoRepository.js'

// Acionado uma vez por dia pelo Cloud Scheduler (mesmo padrão de generator-service's
// /internal/videos-cleanup-tick) — protege o bucket de imagens contra crescimento ilimitado
// (_local-edr-policy-067). Roda as duas limpezas (posts publicados e campanhas canceladas) na
// mesma chamada porque as duas são baratas e diárias; não há motivo pra dois jobs separados.
export async function storageCleanupRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  const cleanupPublishedImages = new CleanupPublishedPostImagesUseCase(
    new FirestorePostRepository(),
    generatorUrl,
    internalSecret,
  )
  const cleanupCancelledCampaignPhotos = new CleanupCancelledCampaignPhotosUseCase(
    new FirestorePhotoCampaignRepository(),
    new FirestoreCampaignItemRepository(),
    new FirestoreCampaignPhotoRepository(),
    generatorUrl,
    internalSecret,
  )

  app.post('/internal/storage-cleanup-tick', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const [publishedImages, cancelledCampaignPhotos] = await Promise.all([
      cleanupPublishedImages.execute(),
      cleanupCancelledCampaignPhotos.execute(),
    ])

    return reply.send({ publishedImages, cancelledCampaignPhotos })
  })
}
