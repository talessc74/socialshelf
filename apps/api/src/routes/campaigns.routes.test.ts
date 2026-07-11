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
vi.mock('../infrastructure/firestore/FirestoreCampaignPhotoRepository.js', () => ({
  FirestoreCampaignPhotoRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    saveAll: vi.fn().mockResolvedValue(undefined),
    findByCampaign: mockPhotoFindByCampaign,
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
})
