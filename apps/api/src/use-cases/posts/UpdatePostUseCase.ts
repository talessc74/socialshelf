import { PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type { Post, PostRepository, PlatformContent } from '@socialshelf/domain'
import type { Platform } from '@socialshelf/domain'

export interface UpdatePostInput {
  post: Post
  content: Array<{ platform: Platform; text: string }>
  imageStoragePaths?: string[]
  scheduledAt?: Date | null
}

export class UpdatePostUseCase {
  constructor(private readonly postRepo: PostRepository) {}

  async execute(input: UpdatePostInput): Promise<Post> {
    const platformContent: PlatformContent[] = input.content.map((c) => {
      const limit = PLATFORM_CHARACTER_LIMITS[c.platform]
      if (c.text.length > limit) {
        throw new Error(
          `Text for ${c.platform} exceeds ${limit} characters (got ${c.text.length})`,
        )
      }
      return { platform: c.platform, text: c.text, charCount: c.text.length }
    })

    const scheduledAt = input.scheduledAt !== undefined ? input.scheduledAt : input.post.scheduledAt
    const status = input.scheduledAt !== undefined ? (input.scheduledAt ? 'scheduled' : 'draft') : input.post.status

    const updated: Post = {
      ...input.post,
      content: platformContent,
      imageStoragePaths: input.imageStoragePaths ?? input.post.imageStoragePaths,
      scheduledAt,
      status,
      updatedAt: new Date(),
    }

    await this.postRepo.save(updated)
    return updated
  }
}
