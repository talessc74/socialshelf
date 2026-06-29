import type { FastifyBaseLogger } from 'fastify'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import type { PublishPostUseCase } from '../use-cases/PublishPostUseCase.js'

export function makeScheduledPostsTick(useCase: PublishPostUseCase, logger: FastifyBaseLogger) {
  const postRepo = new FirestorePostRepository()
  let running = false

  return async function tick(): Promise<void> {
    // Guard against overlapping ticks within this same instance (e.g. a slow publish
    // call running past the next interval, or an HTTP-triggered tick arriving while the
    // in-process interval is still running); the cross-instance race is handled by
    // PostRepository.claimForPublishing.
    if (running) return
    running = true
    try {
      const due = await postRepo.findScheduledBefore(new Date())
      for (const post of due ?? []) {
        try {
          await useCase.execute(post.id, post.userId, post.brandId)
          logger.info(`published scheduled post ${post.id}`)
        } catch (err) {
          logger.error({ err, postId: post.id }, 'failed to publish scheduled post')
        }
      }
    } catch (err) {
      logger.error({ err }, 'failed to poll scheduled posts')
    } finally {
      running = false
    }
  }
}

/**
 * Em Cloud Run com --min-instances=0 o container é desligado quando não há tráfego, então
 * este setInterval só roda enquanto uma instância já está de pé por outro motivo (ex.: uma
 * publicação manual recente). O gatilho confiável é o endpoint HTTP em scheduler.routes.ts,
 * acionado pelo Cloud Scheduler — ele força o Cloud Run a acordar a instância no horário certo.
 * Mantemos este poller em memória como reforço para quando a instância já estiver ativa.
 */
export function startScheduledPostsPoller(
  useCase: PublishPostUseCase,
  logger: FastifyBaseLogger,
  intervalMs = 60_000,
): () => void {
  const tick = makeScheduledPostsTick(useCase, logger)
  const timer = setInterval(() => void tick(), intervalMs)
  void tick()
  return () => clearInterval(timer)
}
