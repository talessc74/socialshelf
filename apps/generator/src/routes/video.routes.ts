import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GcsVideoStorage } from '../infrastructure/storage/GcsVideoStorage.js'

const uploadVideoSchema = z.object({
  userId: z.string().min(1),
  brandId: z.string().min(1),
  base64: z.string().min(1),
  mimeType: z.enum(['video/mp4', 'video/webm', 'video/quicktime']),
})

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function videoRoutes(app: FastifyInstance) {
  const generatedBucket = process.env['GCS_BUCKET_GENERATED'] ?? ''
  const videoStorage = new GcsVideoStorage(generatedBucket)

  const internalSecret = process.env['INTERNAL_SECRET']
  if (!internalSecret) {
    throw new Error('INTERNAL_SECRET env var is required — set it before starting the generator service')
  }

  app.post('/videos/upload', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = uploadVideoSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const path = await videoStorage.upload(
        parsed.data.userId,
        parsed.data.brandId,
        Buffer.from(parsed.data.base64, 'base64'),
        parsed.data.mimeType,
        'upload',
      )
      return reply.send({ path })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'video upload failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  app.get('/videos/signed-url', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = z.object({ path: z.string().min(1) }).safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    }

    try {
      const url = await videoStorage.getSignedUrl(parsed.data.path, 3600)
      return reply.send({ url })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'video signed url failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  // Acionado por Cloud Scheduler (OIDC + X-Internal-Secret, mesmo padrão de
  // publisher-service's /internal/scheduler-tick) uma vez por dia. Apaga vídeos com mais
  // de 7 dias (_local-edr-policy-034). Falha em um arquivo não interrompe os demais —
  // reportado na resposta para quem quiser investigar, não silenciosamente engolido.
  app.post('/internal/videos-cleanup-tick', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const paths = await videoStorage.listOlderThan(SEVEN_DAYS_MS)
    const deleted: string[] = []
    const failed: { path: string; error: string }[] = []

    for (const path of paths) {
      try {
        await videoStorage.delete(path)
        deleted.push(path)
      } catch (err) {
        failed.push({ path, error: err instanceof Error ? err.message : String(err) })
      }
    }

    if (failed.length > 0) {
      app.log.error({ failed }, 'video cleanup: some files failed to delete')
    }

    return reply.send({ deletedCount: deleted.length, deleted, failed })
  })
}
