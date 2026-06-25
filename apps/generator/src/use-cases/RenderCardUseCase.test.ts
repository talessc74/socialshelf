import { describe, it, expect, vi } from 'vitest'
import { RenderCardUseCase } from './RenderCardUseCase.js'
import { TemplateStyle } from '@socialshelf/domain'
import type { TemplateRendererPort, ImageStoragePort, BrandProfileRepository, BrandProfile } from '@socialshelf/domain'

const mockBrandProfile: BrandProfile = {
  id: 'profile-1',
  userId: 'brand-1',
  brandId: 'brand-1',
  version: 1,
  business: { name: 'Acme', segment: 'tecnologia', description: 'desc' },
  identity: { positioning: 'positioning', values: [] },
  visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: 'brand-1/logo.png' },
  voice: { tone: 'casual', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [] },
  createdAt: new Date(),
}

function makeDeps(brandProfile: BrandProfile | null = mockBrandProfile) {
  const templateRenderer: TemplateRendererPort = {
    render: vi.fn().mockResolvedValue({ base64: 'cmVuZGVyZWQ=', mimeType: 'image/png' }),
  }

  const imageStorage: ImageStoragePort = {
    upload: vi.fn().mockResolvedValue('brand-1/brand-1/card-123.png'),
    download: vi.fn().mockResolvedValue({ base64: 'dXBsb2FkZWQ=', mimeType: 'image/png' }),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
  }

  const brandProfileRepo: BrandProfileRepository = {
    save: vi.fn(),
    findLatestByBrand: vi.fn().mockResolvedValue(brandProfile),
    findByBrandAndVersion: vi.fn(),
  }

  return { templateRenderer, imageStorage, brandProfileRepo }
}

describe('RenderCardUseCase', () => {
  it('downloads the uploaded image, renders the template, and uploads the result', async () => {
    const { templateRenderer, imageStorage, brandProfileRepo } = makeDeps()
    const useCase = new RenderCardUseCase(templateRenderer, imageStorage, brandProfileRepo)

    const result = await useCase.execute({
      userId: 'brand-1',
      brandId: 'brand-1',
      imageStoragePath: 'brand-1/brand-1/upload-1.png',
      headline: 'Minha headline',
      body: 'Meu corpo',
      style: TemplateStyle.BOLD_BOTTOM,
    })

    expect(imageStorage.download).toHaveBeenCalledWith('brand-1/brand-1/upload-1.png')
    expect(imageStorage.download).toHaveBeenCalledWith('brand-1/logo.png')
    expect(templateRenderer.render).toHaveBeenCalledWith({
      backgroundImage: { base64: 'dXBsb2FkZWQ=', mimeType: 'image/png' },
      headline: 'Minha headline',
      body: 'Meu corpo',
      style: TemplateStyle.BOLD_BOTTOM,
      brandTokens: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter' },
      logoImage: { base64: 'dXBsb2FkZWQ=', mimeType: 'image/png' },
    })
    expect(imageStorage.upload).toHaveBeenCalledWith(
      'brand-1',
      'brand-1',
      Buffer.from('cmVuZGVyZWQ=', 'base64'),
      'image/png',
      'card',
    )
    expect(result).toEqual({ imageStoragePath: 'brand-1/brand-1/card-123.png' })
  })

  it('renders without brand tokens or logo when no brand profile exists', async () => {
    const { templateRenderer, imageStorage, brandProfileRepo } = makeDeps(null)
    const useCase = new RenderCardUseCase(templateRenderer, imageStorage, brandProfileRepo)

    await useCase.execute({
      userId: 'brand-1',
      brandId: 'brand-1',
      imageStoragePath: 'brand-1/brand-1/upload-1.png',
      headline: '',
      body: null,
      style: TemplateStyle.NO_TEXT,
    })

    expect(imageStorage.download).toHaveBeenCalledTimes(1)
    expect(templateRenderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ brandTokens: null, logoImage: null }),
    )
  })
})
