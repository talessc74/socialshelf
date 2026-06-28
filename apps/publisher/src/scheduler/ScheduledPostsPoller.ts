import type { FastifyBaseLogger } from 'fastify'
import { FirestorePostRepository } from '../infrastructure/firestore/FirestorePostRepository.js'
import type { PublishPostUseCase } from '../use-cases/PublishPostUseCase.js'

export function startScheduledPostsPoller(
  useCase: PublishPostUseCase,
  logger: FastifyBaseLogger,
  intervalMs = 60_000,
): () => void {
  const postRepo = new FirestorePostRepository()
  let running = false

  const tick = async () => {
    // Guard against overlapping ticks within this same instance (e.g. a slow publish
    // call running past the next interval); the cross-instance race is handled by
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

  const timer = setInterval(() => void tick(), intervalMs)
  void tick()
  return () => clearInterval(timer)
}
