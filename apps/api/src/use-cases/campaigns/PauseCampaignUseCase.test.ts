import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform } from '@socialshelf/domain'
import type {
  CampaignItem,
  CampaignItemRepository,
  CampaignTimelineLockRepository,
  PhotoCampaign,
  PhotoCampaignRepository,
  Post,
  PostRepository,
} from '@socialshelf/domain'
import { PauseCampaignUseCase } from './PauseCampaignUseCase.js'

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
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date('2026-07-01T00:00:00.000Z'),
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

describe('PauseCampaignUseCase', () => {
  let campaignRepo: PhotoCampaignRepository
  let itemRepo: CampaignItemRepository
  let postRepo: PostRepository
  let lockRepo: CampaignTimelineLockRepository
  let useCase: PauseCampaignUseCase

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
      findByCampaign: vi.fn().mockResolvedValue([makeItem()]),
      deleteByCampaign: vi.fn(),
    }
    postRepo = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(makePost()),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn(),
      findScheduledBefore: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
      claimForPublishing: vi.fn(),
    }
    lockRepo = {
      tryAcquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
    }
    useCase = new PauseCampaignUseCase(campaignRepo, itemRepo, postRepo, lockRepo)
  })

  it('rejects when the campaign does not exist', async () => {
    vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(null)
    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('Campaign not found')
  })

  it.each(['draft', 'reviewing', 'paused', 'completed', 'cancelled'] as const)(
    'rejects pausing a campaign that is %s',
    async (status) => {
      vi.mocked(campaignRepo.findByIdAndBrand).mockResolvedValue(makeCampaign({ status }))
      await expect(
        useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
      ).rejects.toThrow('Only an active campaign can be paused')
      expect(campaignRepo.save).not.toHaveBeenCalled()
    },
  )

  it('rejects when another concurrent timeline update already holds the lock', async () => {
    vi.mocked(lockRepo.tryAcquire).mockResolvedValue(false)
    await expect(
      useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' }),
    ).rejects.toThrow('already in progress')
    expect(postRepo.delete).not.toHaveBeenCalled()
  })

  it('releases the lock after a successful run', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    expect(lockRepo.release).toHaveBeenCalledWith('user-1', 'brand-1', 'campaign-1')
  })

  it('deletes not-yet-published posts and reverts their items to planned', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.delete).toHaveBeenCalledWith('post-1')
    const savedItems = vi.mocked(itemRepo.saveAll).mock.calls[0]![0]
    expect(savedItems[0]).toMatchObject({ status: 'planned', postId: null })
  })

  it('leaves already-published posts and their items untouched', async () => {
    vi.mocked(postRepo.findById).mockResolvedValue(makePost({ status: 'published' }))

    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })

    expect(postRepo.delete).not.toHaveBeenCalled()
    expect(itemRepo.saveAll).not.toHaveBeenCalled()
  })

  it('sets the campaign status to paused', async () => {
    await useCase.execute({ userId: 'user-1', brandId: 'brand-1', campaignId: 'campaign-1' })
    const savedCampaign = vi.mocked(campaignRepo.save).mock.calls[0]![0]
    expect(savedCampaign.status).toBe('paused')
  })
})
