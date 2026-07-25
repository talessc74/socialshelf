import type { Post, PostRepository } from '@socialshelf/domain'

export class SetPostSavedForLaterUseCase {
  constructor(private readonly postRepo: PostRepository) {}

  async execute(post: Post, savedForLater: boolean): Promise<Post> {
    const updated: Post = { ...post, savedForLater, updatedAt: new Date() }
    await this.postRepo.save(updated)
    return updated
  }
}
