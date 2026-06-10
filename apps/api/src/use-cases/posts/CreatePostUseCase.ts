import { randomUUID } from 'crypto'
import { PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type { Post, PostRepository, PlatformContent } from '@socialshelf/domain'
import { Platform } from '@socialshelf/domain'

export interface CreatePostInput {
  userId: string
  brandId: string
  content: Array<{ platform: Platform; text: string }>
  imageStoragePaths?: string[]
}

export class CreatePostUseCase {
  constructor(private readonly postRepo: PostRepository) {}

  async execute(input: CreatePostInput): Promise<Post> {
    const platformContent: PlatformContent[] = input.content.map((c) => {
      const limit = PLATFORM_CHARACTER_LIMITS[c.platform]
      if (c.text.length > limit) {
        throw new Error(
          `Text for ${c.platform} exceeds ${limit} characters (got ${c.text.length})`,
        )
      }
      return { platform: c.platform, text: c.text, charCount: c.text.length }
    })

    const post: Post = {
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      content: platformContent,
      imageStoragePaths: input.imageStoragePaths ?? [],
      status: 'draft',
      scheduledAt: null,
      publishedAt: null,
      externalIds: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.postRepo.save(post)
    return post
  }
}
