import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { isAdminEmail } from '@socialshelf/domain'
import { adminAuth } from '../infrastructure/firebase-admin.js'
import { FirestoreBrandRepository } from '../infrastructure/firestore/FirestoreBrandRepository.js'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    userId: string
    brandId: string
    userEmail: string | null
  }
}

export async function registerAuthMiddleware(app: FastifyInstance): Promise<void> {
  const brandRepo = new FirestoreBrandRepository()

  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid authorization header' })
      }

      const idToken = authHeader.slice(7)

      try {
        const decoded = await adminAuth.verifyIdToken(idToken)
        request.userId = decoded.uid
        request.userEmail = decoded.email ?? null
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' })
      }

      // O cliente sugere a marca via header; o servidor valida posse antes de confiar.
      // Sem header (clientes legados), a marca implícita é o próprio usuário.
      const requestedBrandId = request.headers['x-brand-id']
      if (typeof requestedBrandId === 'string' && requestedBrandId.length > 0) {
        const brand = await brandRepo.findById(request.userId, requestedBrandId)
        if (!brand) {
          return reply.status(403).send({ error: 'invalid_brand' })
        }
        request.brandId = requestedBrandId
      } else {
        request.brandId = request.userId
      }
    },
  )

  // Sempre encadeado depois de `authenticate` (preHandler: [app.authenticate, app.requireAdmin])
  // — depende de request.userEmail já estar preenchido. Gate real de autorização no backend, não
  // só uma checagem de UI: rotas de admin (ex.: /admin/ai-usage) enxergam dados de TODAS as
  // contas, então esconder o link no frontend não basta.
  app.decorate(
    'requireAdmin',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!isAdminEmail(request.userEmail)) {
        return reply.status(403).send({ error: 'Forbidden' })
      }
    },
  )
}
