import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: { verifyIdToken: vi.fn().mockResolvedValue({ uid: 'user-test-123' }) },
}))

const findLatestByBrand = vi.fn().mockResolvedValue(null)
const save = vi.fn().mockResolvedValue(undefined)

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save,
    findLatestByBrand,
    findByBrandAndVersion: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('../infrastructure/firestore/FirestorePostRepository.js', () => ({
  FirestorePostRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByBrand: vi.fn().mockResolvedValue([]),
    findScheduledBefore: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreOAuthRepository.js', () => ({
  FirestoreOAuthRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findByBrand: vi.fn().mockResolvedValue([]),
    findByBrandAndPlatform: vi.fn().mockResolvedValue(null),
    findById: vi.fn(),
    findByPairwise: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('../infrastructure/secret-manager/FirestoreTokenVault.js', () => ({
  FirestoreTokenVault: vi.fn().mockImplementation(() => ({
    store: vi.fn(),
    retrieve: vi.fn(),
    delete: vi.fn(),
  })),
}))

const validSections = {
  business: { name: 'Radio Kactus', segment: 'Media', description: 'Community radio' },
  identity: { positioning: 'Close to the community', values: ['local'] },
  visual: {
    primaryColor: '#ff0055',
    secondaryColor: '#0a0a0a',
    typography: 'Inter',
    logoStoragePath: null,
  },
  voice: { tone: 'informal', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: {
    autonomyLevel: 'manual',
    autoPublishTopics: [],
    blockedTopics: [],
    maxAutoPostsPerDay: 1,
    stylePreferences: ['bold-bottom', 'centered-overlay', 'top-strip', 'no-text'],
  },
}

describe('Brand profile routes', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['WEB_URL'] = 'http://localhost:3000'
    process.env['PUBLISHER_URL'] = 'http://localhost:3002'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    findLatestByBrand.mockReset().mockResolvedValue(null)
    save.mockReset().mockResolvedValue(undefined)
  })

  describe('GET /brand-profile', () => {
    it('returns null when no brand profile exists yet', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/brand-profile',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json<{ brandProfile: unknown }>()
      expect(body.brandProfile).toBeNull()
    })

    it('returns 401 without auth header', async () => {
      const response = await app.inject({ method: 'GET', url: '/brand-profile' })
      expect(response.statusCode).toBe(401)
    })
  })

  describe('PUT /brand-profile', () => {
    it('creates version 1 and returns 201', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/brand-profile',
        headers: { authorization: 'Bearer valid-token' },
        payload: validSections,
      })

      expect(response.statusCode).toBe(201)
      const body = response.json<{ brandProfile: { version: number } }>()
      expect(body.brandProfile.version).toBe(1)
    })

    it('increments version when a prior brand profile exists', async () => {
      findLatestByBrand.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-test-123',
        brandId: 'user-test-123',
        version: 2,
        createdAt: new Date(),
        ...validSections,
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/brand-profile',
        headers: { authorization: 'Bearer valid-token' },
        payload: validSections,
      })

      const body = response.json<{ brandProfile: { version: number } }>()
      expect(body.brandProfile.version).toBe(3)
    })

    it('returns 400 when a required section is missing', async () => {
      const { business: _business, ...incomplete } = validSections

      const response = await app.inject({
        method: 'PUT',
        url: '/brand-profile',
        headers: { authorization: 'Bearer valid-token' },
        payload: incomplete,
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when stylePreferences is missing a style (not a full permutation)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/brand-profile',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          ...validSections,
          operation: { ...validSections.operation, stylePreferences: ['bold-bottom', 'centered-overlay'] },
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 when stylePreferences repeats a style', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/brand-profile',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          ...validSections,
          operation: {
            ...validSections.operation,
            stylePreferences: ['bold-bottom', 'bold-bottom', 'top-strip', 'no-text'],
          },
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 401 without auth header', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/brand-profile',
        payload: validSections,
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
