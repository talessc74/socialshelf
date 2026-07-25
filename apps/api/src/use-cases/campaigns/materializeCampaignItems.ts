import { randomUUID } from 'crypto'
import { PLATFORM_CHARACTER_LIMITS } from '@socialshelf/domain'
import type { CampaignItem, CampaignPhoto, PhotoCampaign, PlatformContent, Post, PostRepository } from '@socialshelf/domain'

// Compartilhado entre ActivateCampaignUseCase (materializa tudo que ainda é 'planned' ao
// ativar) e ExtendCampaignTimelineUseCase (materializa na hora os itens novos anexados a uma
// campanha já 'active') — os dois transformam um CampaignItem 'planned' num Post real agendado.
export async function materializeCampaignItems(
  campaign: PhotoCampaign,
  items: CampaignItem[],
  photosById: Map<string, CampaignPhoto>,
  postRepo: PostRepository,
  brandProfileVersion: number | null,
): Promise<CampaignItem[]> {
  const materialized: CampaignItem[] = []
  for (const item of items) {
    const imageStoragePaths = item.photoIds.map((photoId) => {
      const photo = photosById.get(photoId)
      if (!photo) throw new Error(`Photo ${photoId} referenced by campaign item ${item.id} not found`)
      return photo.storagePath
    })

    const content: PlatformContent[] = campaign.platforms.map((platform) => {
      const limit = PLATFORM_CHARACTER_LIMITS[platform]
      const text = item.caption.length > limit ? item.caption.slice(0, limit) : item.caption
      return { platform, text, charCount: text.length }
    })

    const post: Post = {
      id: randomUUID(),
      userId: campaign.userId,
      brandId: campaign.brandId,
      brandProfileVersion,
      content,
      imageStoragePaths,
      videoStoragePath: null,
      videoConsentAcceptedAt: null,
      status: 'scheduled',
      origin: 'campaign',
      campaignId: campaign.id,
      scheduledAt: item.scheduledAt,
      publishedAt: null,
      externalIds: {},
      sourceArticleUrl: null,
      imagesDeletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await postRepo.save(post)
    materialized.push({ ...item, status: 'materialized', postId: post.id })
  }
  return materialized
}
