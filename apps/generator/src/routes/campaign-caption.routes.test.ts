import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockBrandProfile = {
  id: 'profile-1',
  userId: 'user-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1, stylePreferences: [] },
  createdAt: new Date(),
}

const mockFindLatestByBrand = vi.fn().mockResolvedValue(mockBrandProfile)

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrand: mockFindLatestByBrand,
    findByBrandAndVersion: vi.fn(),
  })),
}))

const mockDownload = vi.fn().mockResolvedValue({ base64: 'ZmFrZS1pbWFnZQ==', mimeType: 'image/jpeg' })

vi.mock('../infrastructure/storage/GcsImageStorage.js', () => ({
  GcsImageStorage: vi.fn().mockImplementation(() => ({
    upload: vi.fn(),
    download: mockDownload,
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  })),
}))

const mockWrite = vi.fn().mockResolvedValue({ caption: 'Um pôr do sol inesquecível em Paris' })

vi.mock('../infrastructure/vertexai/GeminiCampaignCaptionWriter.js', () => ({
  GeminiCampaignCaptionWriter: vi.fn().mockImplementation(() => ({
    write: mockWrite,
  })),
}))

describe('POST /campaigns/caption-suggestion', () => {
  let app: FastifyInstance

  const validPayload = {
    userId: 'user-1',
    brandId: 'brand-1',
    storagePath: 'user-1/brand-1/photo.jpg',
    campaignName: 'Viagem à Europa',
    campaignDescription: 'Registro da viagem em família',
    keywords: ['viagem'],
  }

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the AI-written caption', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/campaigns/caption-suggestion',
      payload: validPayload,
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ caption: 'Um pôr do sol inesquecível em Paris' })
  })

  it('downloads the cover photo and passes brand voice/business to the writer', async () => {
    await app.inject({
      method: 'POST',
      url: '/campaigns/caption-suggestion',
      payload: validPayload,
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(mockDownload).toHaveBeenCalledWith('user-1/brand-1/photo.jpg')
    expect(mockWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        coverImage: { base64: 'ZmFrZS1pbWFnZQ==', mimeType: 'image/jpeg' },
        brandBusiness: mockBrandProfile.business,
        brandVoice: mockBrandProfile.voice,
      }),
    )
  })

  it('returns 400 when campaignName is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/campaigns/caption-suggestion',
      payload: { ...validPayload, campaignName: '' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 when INTERNAL_SECRET header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/campaigns/caption-suggestion',
      payload: validPayload,
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 500 when the caption writer throws', async () => {
    mockWrite.mockRejectedValueOnce(new Error('gemini exploded'))

    const response = await app.inject({
      method: 'POST',
      url: '/campaigns/caption-suggestion',
      payload: validPayload,
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(500)
  })
})
