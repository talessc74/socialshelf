import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const mockCampaignSave = vi.fn().mockResolvedValue(undefined)
const mockCampaignFindByBrand = vi.fn().mockResolvedValue([])
const mockCampaignFindByIdAndBrand = vi.fn().mockResolvedValue(null)

vi.mock('../infrastructure/firestore/FirestorePhotoCampaignRepository.js', () => ({
  FirestorePhotoCampaignRepository: vi.fn().mockImplementation(() => ({
    save: mockCampaignSave,
    findById: vi.fn().mockResolvedValue(null),
    findByIdAndBrand: mockCampaignFindByIdAndBrand,
    findByBrand: mockCampaignFindByBrand,
  })),
}))

const mockPhotoFindByCampaign = vi.fn().mockResolvedValue([])
const mockPhotoDelete = vi.fn().mockResolvedValue(null)
const mockPhotoCountByCampaign = vi.fn().mockResolvedValue(0)
const mockPhotoReorder = vi.fn().mockResolvedValue(undefined)
vi.mock('../infrastructure/firestore/FirestoreCampaignPhotoRepository.js', () => ({
  FirestoreCampaignPhotoRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    saveAll: vi.fn().mockResolvedValue(undefined),
    findByCampaign: mockPhotoFindByCampaign,
    delete: mockPhotoDelete,
    countByCampaign: mockPhotoCountByCampaign,
    reorder: mockPhotoReorder,
  })),
}))

const mockItemFindByCampaign = vi.fn().mockResolvedValue([])
vi.mock('../infrastructure/firestore/FirestoreCampaignItemRepository.js', () => ({
  FirestoreCampaignItemRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    saveAll: vi.fn().mockResolvedValue(undefined),
    findByCampaign: mockItemFindByCampaign,
    deleteByCampaign: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    findByIdAndBrand: vi.fn(),
    findByBrand: vi.fn(),
    findScheduledBefore: vi.fn(),
    delete: vi.fn(),
    claimForPublishing: vi.fn(),
    findPublishedForImageCleanup: vi.fn(),
    findSavedForLaterByBrand: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findLatestByBrand: vi.fn().mockResolvedValue(null),
    findByBrandAndVersion: vi.fn(),
  })),
}))

describe('Campaigns routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('POST /campaigns', () => {
    it('creates a campaign and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          name: 'Viagem à Europa',
          description: 'Fotos da viagem',
          keywords: ['viagem'],
          platforms: ['instagram', 'facebook'],
          postsPerDay: 3,
          carouselSizeDefault: 5,
        },
      })

      expect(response.statusCode).toBe(201)
      expect(mockCampaignSave).toHaveBeenCalledTimes(1)
    })

    it('rejects a campaign that includes X (Twitter) with 422', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          name: 'Viagem à Europa',
          platforms: ['twitter'],
          postsPerDay: 1,
          carouselSizeDefault: 5,
        },
      })

      expect(response.statusCode).toBe(422)
    })

    it('rejects an invalid body with 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/campaigns',
        headers: { authorization: 'Bearer valid-token' },
        payload: { name: 'Sem redes', platforms: [], postsPerDay: 3, carouselSizeDefault: 5 },
      })

      expect(response.statusCode).toBe(400)
    })

    it('requires authentication', async () => {
      const response = await app.inject({ method: 'POST', url: '/campaigns', payload: {} })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /campaigns', () => {
    it('lists campaigns for the active brand', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/campaigns',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(mockCampaignFindByBrand).toHaveBeenCalled()
    })

    it('includes a photoCount per campaign so the UI can tell an empty draft from one with photos already uploaded', async () => {
      mockCampaignFindByBrand.mockResolvedValueOnce([{ id: 'campaign-1', status: 'draft' }])
      mockPhotoCountByCampaign.mockResolvedValueOnce(148)

      const response = await app.inject({
        method: 'GET',
        url: '/campaigns',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ campaigns: Array<{ id: string; photoCount: number }> }>()
      expect(body.campaigns[0]!.photoCount).toBe(148)
    })
  })

  describe('GET /campaigns/:id', () => {
    it('returns 404 when the campaign does not exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/campaigns/missing',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /campaigns/:id/photos', () => {
    it('returns 500 with a detail message instead of hanging/silently failing when the repository query errors (e.g. a missing Firestore index)', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1' })
      mockPhotoFindByCampaign.mockRejectedValueOnce(
        new Error('9 FAILED_PRECONDITION: The query requires an index.'),
      )

      const response = await app.inject({
        method: 'GET',
        url: '/campaigns/campaign-1/photos',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toEqual({
        error: 'Internal error',
        detail: '9 FAILED_PRECONDITION: The query requires an index.',
      })
    })
  })

  describe('DELETE /campaigns/:id/photos/:photoId', () => {
    it('deletes a photo and returns 204', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1' })
      mockPhotoDelete.mockResolvedValueOnce({ id: 'photo-1', storagePath: 'uploads/photo-1.jpg' })

      const response = await app.inject({
        method: 'DELETE',
        url: '/campaigns/campaign-1/photos/photo-1',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(204)
      expect(mockPhotoDelete).toHaveBeenCalledWith('user-test-123', expect.any(String), 'campaign-1', 'photo-1')
    })

    it('returns 404 when the campaign does not exist', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/campaigns/missing/photos/photo-1',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 404 when the photo does not exist', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1' })
      mockPhotoDelete.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'DELETE',
        url: '/campaigns/campaign-1/photos/missing-photo',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('PUT /campaigns/:id/photos/order', () => {
    it('persists the new photo order and returns 204', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'draft' })

      const response = await app.inject({
        method: 'PUT',
        url: '/campaigns/campaign-1/photos/order',
        headers: { authorization: 'Bearer valid-token' },
        payload: { photoIds: ['photo-2', 'photo-1'] },
      })

      expect(response.statusCode).toBe(204)
      expect(mockPhotoReorder).toHaveBeenCalledWith('user-test-123', expect.any(String), 'campaign-1', [
        'photo-2',
        'photo-1',
      ])
    })

    it('rejects an empty photoIds array with 400', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/campaigns/campaign-1/photos/order',
        headers: { authorization: 'Bearer valid-token' },
        payload: { photoIds: [] },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 404 when the campaign does not exist', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'PUT',
        url: '/campaigns/missing/photos/order',
        headers: { authorization: 'Bearer valid-token' },
        payload: { photoIds: ['photo-1'] },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 422 once the campaign is active', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'active' })

      const response = await app.inject({
        method: 'PUT',
        url: '/campaigns/campaign-1/photos/order',
        headers: { authorization: 'Bearer valid-token' },
        payload: { photoIds: ['photo-1'] },
      })

      expect(response.statusCode).toBe(422)
    })
  })

  describe('GET /campaigns/:id/timeline', () => {
    it('returns 500 with a detail message instead of hanging/silently failing when the repository query errors', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1' })
      mockItemFindByCampaign.mockRejectedValueOnce(
        new Error('9 FAILED_PRECONDITION: The query requires an index.'),
      )

      const response = await app.inject({
        method: 'GET',
        url: '/campaigns/campaign-1/timeline',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(500)
      expect(response.json()).toEqual({
        error: 'Internal error',
        detail: '9 FAILED_PRECONDITION: The query requires an index.',
      })
    })
  })

  describe('POST /campaigns/:id/cancel', () => {
    it('cancels a draft campaign and returns it', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'draft' })
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'cancelled' })

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/campaign-1/cancel',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<{ campaign: { status: string } }>().campaign.status).toBe('cancelled')
      expect(mockCampaignSave).toHaveBeenCalled()
    })

    it('returns 404 when the campaign does not exist', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/missing/cancel',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('cancels an active campaign too (cascading cleanup, see PauseCampaignUseCase)', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'active' })
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'cancelled' })

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/campaign-1/cancel',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json<{ campaign: { status: string } }>().campaign.status).toBe('cancelled')
    })

    it('returns 422 once the campaign already finished', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'completed' })

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/campaign-1/cancel',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(422)
    })

    it('requires authentication', async () => {
      const response = await app.inject({ method: 'POST', url: '/campaigns/campaign-1/cancel' })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /campaigns/:id/pause', () => {
    it('returns 404 when the campaign does not exist', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/missing/pause',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 422 when the campaign is not active', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'draft' })

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/campaign-1/pause',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(422)
    })

    it('requires authentication', async () => {
      const response = await app.inject({ method: 'POST', url: '/campaigns/campaign-1/pause' })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /campaigns/:id/resume', () => {
    it('returns 404 when the campaign does not exist', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/missing/resume',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 422 when the campaign is not paused', async () => {
      mockCampaignFindByIdAndBrand.mockResolvedValueOnce({ id: 'campaign-1', status: 'active' })

      const response = await app.inject({
        method: 'POST',
        url: '/campaigns/campaign-1/resume',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(422)
    })

    it('requires authentication', async () => {
      const response = await app.inject({ method: 'POST', url: '/campaigns/campaign-1/resume' })
      expect(response.statusCode).toBe(401)
    })
  })
})
