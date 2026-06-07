import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { adminAuth } from '../infrastructure/firebase-admin.js'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    userId: string
  }
}

export async function registerAuthMiddleware(app: FastifyInstance): Promise<void> {
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
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired token' })
      }
    },
  )
}
