import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { FirestoreWorkspaceRepository } from '../infrastructure/firestore/FirestoreWorkspaceRepository.js'

declare module 'fastify' {
  interface FastifyRequest {
    workspaceId: string
    workspaceRole: 'owner' | 'editor' | 'viewer'
  }
}

export async function registerWorkspaceValidationMiddleware(app: FastifyInstance): Promise<void> {
  const workspaceRepo = new FirestoreWorkspaceRepository()

  app.decorate(
    'validateWorkspace',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'User not authenticated' })
      }

      // Cliente sugere workspace via header; servidor valida membership
      const requestedWorkspaceId = request.headers['x-workspace-id']

      let workspaceId: string
      let role: 'owner' | 'editor' | 'viewer'

      if (typeof requestedWorkspaceId === 'string' && requestedWorkspaceId.length > 0) {
        // Workspace foi explicitamente solicitado
        const member = await workspaceRepo.getMember(requestedWorkspaceId, request.userId)
        if (!member) {
          return reply.status(403).send({ error: 'not_member_of_workspace' })
        }
        if (member.status !== 'active') {
          return reply.status(403).send({ error: 'workspace_membership_not_active' })
        }
        workspaceId = requestedWorkspaceId
        role = member.role
      } else {
        // Compatibilidade: usar workspace "pessoal" do usuário
        // Este workspace é criado automaticamente na primeira vez que o usuário faz login
        workspaceId = `personal-${request.userId}`
        role = 'owner'
      }

      request.workspaceId = workspaceId
      request.workspaceRole = role
    },
  )
}
