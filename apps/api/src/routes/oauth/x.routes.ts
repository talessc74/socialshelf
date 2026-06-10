import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import { z } from 'zod'
import { validateState } from '../../lib/csrf.js'
import { GenerateXAuthUrlUseCase } from '../../use-cases/oauth/GenerateXAuthUrlUseCase.js'
import { HandleXCallbackUseCase } from '../../use-cases/oauth/HandleXCallbackUseCase.js'
import { FirestoreOAuthRepository } from '../../infrastructure/firestore/FirestoreOAuthRepository.js'
import { SecretManagerTokenVault } from '../../infrastructure/secret-manager/SecretManagerTokenVault.js'

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  brandId: z.string().optional(),
})

export async function xOAuthRoutes(app: FastifyInstance) {
  await app.register(cookie)

  const oauthRepo = new FirestoreOAuthRepository()
  const tokenVault = new SecretManagerTokenVault()
  const generateUrl = new GenerateXAuthUrlUseCase()
  const handleCallback = new HandleXCallbackUseCase(oauthRepo, tokenVault)

  const webUrl = process.env['WEB_URL'] ?? 'http://localhost:3000'
  const isProduction = process.env['NODE_ENV'] === 'production'

  app.get(
    '/oauth/x/authorize',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { url, codeVerifier, state } = generateUrl.execute(request.userId)

      reply.setCookie('pkce_verifier', codeVerifier, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 600,
        path: '/oauth/x/callback',
      })

      reply.setCookie('oauth_state', state, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 600,
        path: '/oauth/x/callback',
      })

      return reply.send({ url })
    },
  )

  app.get('/oauth/x/callback', async (request, reply) => {
    const result = callbackQuerySchema.safeParse(request.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'Invalid callback parameters' })
    }

    const { code, state } = result.data

    const codeVerifier = request.cookies['pkce_verifier']
    const storedState = request.cookies['oauth_state']

    if (!codeVerifier || !storedState) {
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }

    if (state !== storedState) {
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }

    reply.clearCookie('pkce_verifier', { path: '/oauth/x/callback' })
    reply.clearCookie('oauth_state', { path: '/oauth/x/callback' })

    try {
      const { userId } = validateState(state)
      const brandId = result.data.brandId ?? userId
      if (brandId !== userId) {
        return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
      }
      await handleCallback.execute(code, state, codeVerifier, brandId)
      return reply.redirect(`${webUrl}/dashboard?connected=twitter`)
    } catch (err) {
      app.log.error(err)
      return reply.redirect(`${webUrl}/dashboard?error=oauth_failed`)
    }
  })
}
