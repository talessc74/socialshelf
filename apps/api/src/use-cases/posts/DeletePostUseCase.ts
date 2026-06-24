import type { PostRepository } from '@socialshelf/domain'

export class DeletePostUseCase {
  constructor(private readonly postRepo: PostRepository) {}

  async execute(postId: string): Promise<void> {
    await this.postRepo.delete(postId)
  }
}
