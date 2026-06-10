import type { Post, PostStatus } from '../entities/Post.js'

export interface PostRepository {
  save(post: Post): Promise<void>
  findById(id: string): Promise<Post | null>
  findByBrand(brandId: string, status?: PostStatus): Promise<Post[]>
  findScheduledBefore(cutoff: Date): Promise<Post[]>
  delete(id: string): Promise<void>
}
