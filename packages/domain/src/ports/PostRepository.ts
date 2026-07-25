import type { Post, PostStatus } from '../entities/Post.js'

export interface PostRepository {
  save(post: Post): Promise<void>
  findById(id: string): Promise<Post | null>
  findByIdAndBrand(id: string, userId: string, brandId: string): Promise<Post | null>
  findByBrand(userId: string, brandId: string, status?: PostStatus): Promise<Post[]>
  findScheduledBefore(cutoff: Date): Promise<Post[]>
  /**
   * Posts publicados há mais de `cutoff` cujas imagens ainda não foram apagadas
   * (imagesDeletedAt null) — usado pela limpeza diária de storage (_local-edr-policy-067).
   */
  findPublishedForImageCleanup(cutoff: Date): Promise<Post[]>
  delete(id: string, userId: string, brandId: string): Promise<void>
  /**
   * Atomically transitions the post into the transient 'publishing' lock state, returning
   * the claimed post on success. Returns null if the post is missing or already
   * locked/published by a concurrent caller (e.g. an overlapping poller tick or another
   * Cloud Run instance), preventing the same post from being published more than once.
   */
  claimForPublishing(id: string, userId: string, brandId: string): Promise<Post | null>
}
