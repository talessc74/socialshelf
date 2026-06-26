import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

vi.mock('../infrastructure/firebase-admin.js', () => ({
  db: {},
  adminAuth: {},
}))

const mockBrandProfile = {
  id: 'profile-1',
  userId: 'brand-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
  createdAt: new Date(),
}

vi.mock('../infrastructure/firestore/FirestoreBrandProfileRepository.js', () => ({
  FirestoreBrandProfileRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrand: vi.fn().mockResolvedValue(mockBrandProfile),
    findByBrandAndVersion: vi.fn(),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreAudienceSignalRepository.js', () => ({
  FirestoreAudienceSignalRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrandAndPlatform: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('../infrastructure/firestore/FirestoreTopicSuggestionRepository.js', () => ({
  FirestoreTopicSuggestionRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn(),
    findLatestByBrand: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
  })),
}))

vi.mock('../infrastructure/news/GoogleNewsRssReader.js', () => ({
  GoogleNewsRssReader: vi.fn().mockImplementation(() => ({
    fetchNews: vi.fn().mockResolvedValue([]),
  })),
}))

const mockGenerateCopy = vi.fn().mockResolvedValue({
  copies: { linkedin: { text: 'Copy gerada', charCount: 12 } },
  cta: 'Comente abaixo!',
  headlines: ['Headline gerada'],
  visualBriefs: ['Cena gerada'],
  bodyTexts: ['Corpo gerado'],
})

vi.mock('../infrastructure/vertexai/GeminiCopyGenerator.js', () => ({
  GeminiCopyGenerator: vi.fn().mockImplementation(() => ({
    generateCopy: mockGenerateCopy,
  })),
}))

const mockDirect = vi.fn().mockResolvedValue({ artifacts: [{ position: 1, imagePrompt: 'Cena direcionada', negativePrompt: '' }] })

vi.mock('../infrastructure/vertexai/GeminiArtDirector.js', () => ({
  GeminiArtDirector: vi.fn().mockImplementation(() => ({
    direct: mockDirect,
  })),
}))

const mockGenerateImage = vi.fn().mockResolvedValue({ base64: 'YmFzZTY0', mimeType: 'image/png' })

vi.mock('../infrastructure/vertexai/ImagenImageGenerator.js', () => ({
  ImagenImageGenerator: vi.fn().mockImplementation(() => ({
    generateImage: mockGenerateImage,
  })),
}))

const mockRender = vi.fn().mockResolvedValue({ base64: 'cmVuZGVyZWQ=', mimeType: 'image/png' })

vi.mock('../infrastructure/template/SharpTemplateRenderer.js', () => ({
  SharpTemplateRenderer: vi.fn().mockImplementation(() => ({
    render: mockRender,
  })),
}))

const mockUpload = vi.fn().mockResolvedValue('brand-1/generated/img.png')
const mockGetSignedUrl = vi.fn().mockResolvedValue('https://storage.googleapis.com/signed-url')
const mockDownload = vi.fn().mockResolvedValue({ base64: 'YmFja2dyb3VuZA==', mimeType: 'image/png' })

vi.mock('../infrastructure/storage/GcsImageStorage.js', () => ({
  GcsImageStorage: vi.fn().mockImplementation(() => ({
    upload: mockUpload,
    download: mockDownload,
    getSignedUrl: mockGetSignedUrl,
    delete: vi.fn(),
  })),
}))

const mockGenerationRequest = {
  id: 'gen-1',
  userId: 'brand-1',
  brandId: 'brand-1',
  status: 'ready',
  inputs: {
    description: 'desc',
    textContent: null,
    imageStoragePaths: [],
    targetPlatforms: ['linkedin'],
    topicSuggestionId: null,
    aspectRatio: '1:1',
    style: 'bold-bottom',
  },
  outputs: {
    copies: { linkedin: { text: 'Copy gerada', charCount: 12 } },
    cta: 'Comente abaixo!',
    headlines: ['Headline gerada'],
    visualBriefs: ['Cena gerada'],
    bodyTexts: ['Corpo gerado'],
    artifacts: [
      {
        position: 1,
        status: 'ready',
        imageStoragePath: 'brand-1/generated/img.png',
        backgroundImageStoragePath: 'brand-1/generated/img-bg.png',
        error: null,
      },
    ],
  },
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockFindById = vi.fn().mockResolvedValue(mockGenerationRequest)

vi.mock('../infrastructure/firestore/FirestoreGenerationRequestRepository.js', () => ({
  FirestoreGenerationRequestRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    findById: mockFindById,
    updateStatus: vi.fn().mockResolvedValue(undefined),
    updateOutputs: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn(),
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
  })),
}))

describe('POST /generate', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the resulting generation request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: {
        brandId: 'brand-1',
        description: 'Post sobre lançamento',
        targetPlatforms: ['linkedin'],
      },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ generationRequest: { status: string } }>()
    expect(body.generationRequest.status).toBe('ready')
  })

  it('returns 400 when body is missing required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 when INTERNAL_SECRET header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { brandId: 'brand-1', description: 'desc', targetPlatforms: ['linkedin'] },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /generation-requests/:id', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the generation request when found', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/generation-requests/gen-1',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ generationRequest: { id: string } }>()
    expect(body.generationRequest.id).toBe('gen-1')
  })

  it('returns 404 when not found', async () => {
    mockFindById.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'GET',
      url: '/generation-requests/missing',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('POST /generation-requests/:id/artifacts/:position/edit', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the updated generation request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit',
      payload: { instruction: 'deixe o fundo mais claro' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ generationRequest: { outputs: { artifacts: Array<{ status: string }> } } }>()
    expect(body.generationRequest.outputs.artifacts[0]!.status).toBe('ready')
  })

  it('returns 404 when the generation request is not found', async () => {
    mockFindById.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/missing/artifacts/1/edit',
      payload: { instruction: 'deixe o fundo mais claro' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 400 when instruction is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit',
      payload: {},
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit',
      payload: { instruction: 'deixe o fundo mais claro' },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /generation-requests/:id/artifacts/:position/edit-text', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the updated generation request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit-text',
      payload: { headline: 'Novo headline', body: 'Novo corpo' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ generationRequest: { outputs: { artifacts: Array<{ status: string }>; headlines: string[] } } }>()
    expect(body.generationRequest.outputs.artifacts[0]!.status).toBe('ready')
    expect(body.generationRequest.outputs.headlines[0]).toBe('Novo headline')
  })

  it('returns 404 when the generation request is not found', async () => {
    mockFindById.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/missing/artifacts/1/edit-text',
      payload: { headline: 'Novo headline', body: null },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('returns 422 when the artifact has no saved background', async () => {
    mockFindById.mockResolvedValueOnce({
      ...mockGenerationRequest,
      outputs: {
        ...mockGenerationRequest.outputs,
        artifacts: [{ ...mockGenerationRequest.outputs.artifacts[0], backgroundImageStoragePath: null }],
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit-text',
      payload: { headline: 'Novo headline', body: null },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(422)
  })

  it('returns 400 when headline is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit-text',
      payload: { body: null },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/generation-requests/gen-1/artifacts/1/edit-text',
      payload: { headline: 'Novo headline', body: null },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('POST /cards/render', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with the rendered image path', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/cards/render',
      payload: {
        userId: 'brand-1',
        brandId: 'brand-1',
        imageStoragePath: 'brand-1/brand-1/upload-1.png',
        headline: 'Minha headline',
        body: 'Meu corpo',
        style: 'bold-bottom',
      },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ imageStoragePath: string }>()
    expect(body.imageStoragePath).toBe('brand-1/generated/img.png')
  })

  it('returns 400 when required fields are missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/cards/render',
      payload: { userId: 'brand-1', brandId: 'brand-1' },
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/cards/render',
      payload: {
        userId: 'brand-1',
        brandId: 'brand-1',
        imageStoragePath: 'brand-1/brand-1/upload-1.png',
        style: 'bold-bottom',
      },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /images/signed-url', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env['INTERNAL_SECRET'] = 'test-internal-secret'
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env['INTERNAL_SECRET']
  })

  it('returns 200 with a signed url', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/images/signed-url?path=brand-1/generated/img.png',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<{ url: string }>()
    expect(body.url).toBe('https://storage.googleapis.com/signed-url')
  })

  it('returns 400 when path is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/images/signed-url',
      headers: { 'x-internal-secret': 'test-internal-secret' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 without internal secret', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/images/signed-url?path=brand-1/generated/img.png',
    })

    expect(response.statusCode).toBe(401)
  })
})
