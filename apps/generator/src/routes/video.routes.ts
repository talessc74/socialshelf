import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GcsVideoStorage } from '../infrastructure/storage/GcsVideoStorage.js'
import { GcsImageStorage } from '../infrastructure/storage/GcsImageStorage.js'
import { FfmpegVideoComposer } from '../infrastructure/video/FfmpegVideoComposer.js'
import { GoogleTextToSpeechSynthesizer } from '../infrastructure/tts/GoogleTextToSpeechSynthesizer.js'
import { FirestoreGenerationRequestRepository } from '../infrastructure/firestore/FirestoreGenerationRequestRepository.js'

const uploadVideoSchema = z.object({
  userId: z.string().min(1),
  brandId: z.string().min(1),
  base64: z.string().min(1),
  mimeType: z.enum(['video/mp4', 'video/webm', 'video/quicktime']),
})

const composeSlideshowSchema = z.object({
  userId: z.string().min(1),
  brandId: z.string().min(1),
  requestId: z.string().min(1),
  imagePaths: z.array(z.string().min(1)).min(1).max(10),
  // _local-adr-policy-037: narração dita a duração do vídeo quando presente; o texto vem
  // da copy já gerada pelo pipeline, nunca de um campo de texto livre novo.
  narrationText: z.string().min(1).max(4500).optional(),
})

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const SLIDE_DURATION_SECONDS = 3

export async function videoRoutes(app: FastifyInstance) {
  const generatedBucket = process.env['GCS_BUCKET_GENERATED'] ?? ''
  const videoStorage = new GcsVideoStorage(generatedBucket)
  const imageStorage = new GcsImageStorage(generatedBucket)
  const videoComposer = new FfmpegVideoComposer()
  const textToSpeech = new GoogleTextToSpeechSynthesizer()
  const generationRequestRepo = new FirestoreGenerationRequestRepository()

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

    const parsed = z
      .object({ path: z.string().min(1), download: z.enum(['true', 'false']).optional() })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
    }

    try {
      const url = await videoStorage.getSignedUrl(
        parsed.data.path,
        3600,
        parsed.data.download === 'true' ? 'video.mp4' : undefined,
      )
      return reply.send({ url })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'video signed url failed')
      return reply.status(500).send({ error: 'Internal error', detail })
    }
  })

  // Fatia experimental síncrona (_local-adr-policy-036 exige assíncrono para o pipeline
  // completo — esta é uma ação avulsa, opt-in, disparada por um clique explícito na tela de
  // resultado da geração, não parte do POST /generate original). Compõe um slideshow a
  // partir de imagens já geradas, com narração opcional (_local-adr-policy-037), sobe o
  // resultado e persiste o path em outputs.composedVideo do GenerationRequest — assim o
  // vídeo sobrevive a um reload da tela de resultado, e não só à resposta HTTP desta chamada.
  app.post('/videos/compose-slideshow', async (request, reply) => {
    const header = request.headers['x-internal-secret']
    if (header !== internalSecret) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = composeSlideshowSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
    }

    try {
      const imageBuffers = await Promise.all(
        parsed.data.imagePaths.map(async (path) => {
          const { base64 } = await imageStorage.download(path)
          return Buffer.from(base64, 'base64')
        }),
      )

      const narrationAudioBuffer = parsed.data.narrationText
        ? await textToSpeech.synthesize(parsed.data.narrationText)
        : null

      const { videoBuffer, durationSeconds } = await videoComposer.composeSlideshow({
        imageBuffers,
        narrationAudioBuffer,
        silentSlideDurationSeconds: SLIDE_DURATION_SECONDS,
      })
      const path = await videoStorage.upload(
        parsed.data.userId,
        parsed.data.brandId,
        videoBuffer,
        'video/mp4',
        parsed.data.requestId,
      )

      // Best-effort: se a escrita no Firestore falhar, o vídeo já foi composto e enviado com
      // sucesso — devolver o path para a pré-visualização importa mais do que a persistência.
      try {
        const generationRequest = await generationRequestRepo.findById(parsed.data.requestId)
        if (generationRequest?.outputs) {
          await generationRequestRepo.updateOutputs(generationRequest.id, {
            ...generationRequest.outputs,
            composedVideo: { storagePath: path, durationSeconds, narrated: narrationAudioBuffer !== null },
          })
        }
      } catch (err) {
        app.log.error({ err }, 'failed to persist composed video onto generation request')
      }

      return reply.send({ path, durationSeconds })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'compose slideshow failed')
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
