import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  CampaignItem,
  CampaignItemRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
  Post,
  PostRepository,
} from '@socialshelf/domain'
import { CancelCampaignUseCase } from './CancelCampaignUseCase.js'

function makeCampaign(overrides: Partial<PhotoCampaign> = {}): PhotoCampaign {
  return {
    id: 'campaign-1',
    userId: 'user-1',
    brandId: 'brand-1',
    name: 'Viagem à Europa',
    description: 'Fotos da viagem',
    keywords: [],
    platforms: [Platform.INSTAGRAM],
    postsPerDay: 2,
    carouselSizeDefault: 2,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<CampaignItem> = {}): CampaignItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    brandId: 'brand-1',
    campaignId: 'campaign-1',
    order: 0,
    photoIds: ['photo-1'],
    caption: 'Legenda',
    scheduledAt: new Date('2026-07-15T09:00:00.000Z'),
    status: 'materialized',
    postId: 'post-1',
    ...overrides,
  }
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: null,
    content: [],
    imageStoragePaths: ['gs://bucket/photo-1.jpg'],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'scheduled',
    origin: 'campaign',
    campaignId: 'campaign-1',
    scheduledAt: new Date('2026-07-15T09:00:00.000Z'),
    publishedAt: null,
    externalIds: {},
    sourceArticleUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('CancelCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let itemRepo: CampaignItemRepository
  let postRepo: PostRepository
  let useCase: CancelCampaignUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn().mockResolvedValue(makeCampaign()),
      findByBrand: vi.fn(),
    }
    itemRepo = {
      save: vi.fn(),
      saveAll: vi.fn().mockResolvedValue(undefined),
      findByCampaign: vi.fn().mockResolvedValue([]),
      deleteByCampaign: vi.fn(),
    }
    postRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      claimForPublishing: vi.fn(),
    }
    useCase = new CancelCampaignUseCase(campaignRepo, itemRepo, postRepo)
  })

  it('rejects when the campaign does not exist', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(null)
    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('Campaign not found')
  })

  it.each(['draft', 'reviewing'] as const)('cancels a campaign in %s status without touching posts', async (status) => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('cancelled')
    expect(itemRepo.findByCampaign).not.toHaveBeenCalled()
    expect(postRepo.delete).not.toHaveBeenCalled()
  })

  it.each(['completed', 'cancelled'] as const)('rejects cancelling a campaign that already %s', async (status) => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))

    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('already finished')
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it.each(['active', 'paused'] as const)(
    'cancelling a %s campaign deletes still-scheduled posts and marks the campaign cancelled',
    async (status) => {
      vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))
      vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem()])
      vi.mocked(postRepo.findById).mockResolvedValue(makePost())

      await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

      expect(postRepo.delete).toHaveBeenCalledWith('post-1', 'user-1', 'brand-1')
      const savedItems = vi.mocked(itemRepo.saveAll).mock.calls[0]![0]
      expect(savedItems[0]).toMatchObject({ status: 'planned', postId: null })
      const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
      expect(savedCampaign.status).toBe('cancelled')
    },
  )

  it('leaves already-published posts untouched when cancelling an active campaign', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status: 'active' }))
    vi.mocked(itemRepo.findByCampaign).mockResolvedValue([makeItem()])
    vi.mocked(postRepo.findById).mockResolvedValue(makePost({ status: 'published' }))

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.delete).not.toHaveBeenCalled()
    expect(itemRepo.saveAll).not.toHaveBeenCalled()
    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('cancelled')
  })
})
