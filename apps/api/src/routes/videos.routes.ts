import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { fetchInternal } from '../lib/serviceAuth.js'

const ALLOWED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
// Limites da Content Posting API do TikTok (_local-adr-policy-035): 3–600s de duração.
const MIN_DURATION_SECONDS = 3
const MAX_DURATION_SECONDS = 600

const composeSlideshowSchema = z.object({
  requestId: z.string().min(1),
  imagePaths: z.array(z.string().min(1)).min(1).max(10),
})

export async function videosRoutes(app: FastifyInstance) {
  const generatorUrl = process.env['GENERATOR_URL'] ?? 'http://localhost:3003'
  const internalSecret = process.env['INTERNAL_SECRET'] ?? ''

  app.post(
    '/videos/upload',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let mimeType = ''
      let durationSeconds: number | null = null
      let consent = false

      for await (const part of parts) {
        if (part.type === 'file') {
          if (!ALLOWED_MIME_TYPES.includes(part.mimetype)) {
            return reply.status(400).send({ error: 'Unsupported video type' })
          }
          mimeType = part.mimetype
          fileBuffer = await part.toBuffer()
        } else if (part.fieldname === 'durationSeconds') {
          durationSeconds = Number(part.value)
        } else if (part.fieldname === 'consent') {
          consent = part.value === 'true'
        }
      }

      if (!fileBuffer) {
        return reply.status(400).send({ error: 'No file provided' })
      }

      // Consentimento é exigido antes do arquivo ser aceito para processamento —
      // _local-edr-policy-034: "sem checkbox marcado, sem upload". A UI já desabilita o
      // botão de envio, mas a API valida de novo (defesa em profundidade).
      if (!consent) {
        return reply.status(400).send({ error: 'Consent is required before uploading video' })
      }

      if (
        durationSeconds === null ||
        Number.isNaN(durationSeconds) ||
        durationSeconds < MIN_DURATION_SECONDS ||
        durationSeconds > MAX_DURATION_SECONDS
      ) {
        return reply.status(400).send({
          error: `Video duration must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS} seconds`,
        })
      }

      const res = await fetchInternal(`${generatorUrl}/videos/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({
          userId: request.userId,
          brandId: request.brandId,
          base64: fileBuffer.toString('base64'),
          mimeType,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      const { path } = (await res.json()) as { path: string }
      return reply.send({ path, consentAcceptedAt: new Date().toISOString() })
    },
  )

  // Ação experimental, opt-in: monta um vídeo animado (slideshow com Ken Burns, sem áudio)
  // a partir de imagens já geradas por IA — não passa pelo checkbox de consentimento de
  // _local-edr-policy-034, que é especificamente sobre vídeo enviado pelo usuário contendo
  // conteúdo de terceiros; aqui o conteúdo é o mesmo já gerado pelo próprio pipeline de IA.
  app.post(
    '/videos/compose-slideshow',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = composeSlideshowSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.flatten() })
      }

      const res = await fetchInternal(`${generatorUrl}/videos/compose-slideshow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': internalSecret,
        },
        body: JSON.stringify({
          userId: request.userId,
          brandId: request.brandId,
          requestId: parsed.data.requestId,
          imagePaths: parsed.data.imagePaths,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )

  app.get(
    '/videos/signed-url',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = z.object({ path: z.string().min(1) }).safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query', details: parsed.error.flatten() })
      }

      if (!parsed.data.path.startsWith(`videos/${request.userId}/`)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const res = await fetchInternal(
        `${generatorUrl}/videos/signed-url?path=${encodeURIComponent(parsed.data.path)}`,
        { headers: { 'X-Internal-Secret': internalSecret } },
      )

      if (!res.ok) {
        const body = await res.text()
        app.log.error(`Generator error ${res.status}: ${body}`)
        return reply.status(502).send({ error: 'Generator error', detail: body })
      }

      return reply.send(await res.json())
    },
  )
}
