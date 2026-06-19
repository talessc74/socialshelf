import { randomUUID } from 'crypto'
import { PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type {
  Post,
  PostRepository,
  PlatformContent,
  BrandProfileRepository,
} from '@socialshelf/domain'
import { Platform } from '@socialshelf/domain'

export interface CreatePostInput {
  userId: string
  brandId: string
  content: Array<{ platform: Platform; text: string }>
  imageStoragePaths?: string[]
}

export class CreatePostUseCase {
  constructor(
    private readonly postRepo: PostRepository,
    private readonly brandProfileRepo: BrandProfileRepository,
  ) {}

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

    const latestBrandProfile = await this.brandProfileRepo.findLatestByBrand(input.brandId)

    const post: Post = {
      id: randomUUID(),
      userId: input.userId,
      brandId: input.brandId,
      brandProfileVersion: latestBrandProfile?.version ?? null,
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
