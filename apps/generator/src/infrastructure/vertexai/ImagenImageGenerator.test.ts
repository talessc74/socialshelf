import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AspectRatio, TemplateStyle } from '@socialshelf/domain'
import type { AiUsageRecorderPort, ImagePrompt } from '@socialshelf/domain'
import { ImagenImageGenerator } from './ImagenImageGenerator.js'

const mockGetAccessToken = vi.fn().mockResolvedValue('fake-token')

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getAccessToken: mockGetAccessToken,
  })),
}))

function basePrompt(): ImagePrompt {
  return {
    userId: 'user-1',
    brandId: 'brand-1',
    description: 'a warm editorial photo of a founder at a desk',
    brandTokens: null,
    position: 1,
    totalArtifacts: 1,
    aspectRatio: AspectRatio.SQUARE,
    templateStyle: TemplateStyle.BOLD_BOTTOM,
    hasTextOverlay: false,
  }
}

describe('ImagenImageGenerator', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let usageRecorder: AiUsageRecorderPort & { record: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ predictions: [{ bytesBase64Encoded: 'YmFzZTY0', mimeType: 'image/png' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    usageRecorder = { record: vi.fn().mockResolvedValue(undefined) }
  })

  it('registra uma imagem gerada, com o custo estimado por imagem, atribuída à marca certa', async () => {
    const generator = new ImagenImageGenerator('project-1', 'us-central1', 'imagen-4.0-generate-001', usageRecorder)

    await generator.generateImage(basePrompt())

    expect(usageRecorder.record).toHaveBeenCalledWith({
      userId: 'user-1',
      brandId: 'brand-1',
      category: 'image-generation',
      operation: 'imagen-generation',
      model: 'imagen-4.0-generate-001',
      imageCount: 1,
      estimatedCostUsd: 0.04,
    })
  })

  it('não registra uso quando o Imagen falha', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') })
    const generator = new ImagenImageGenerator('project-1', 'us-central1', 'imagen-4.0-generate-001', usageRecorder)

    await expect(generator.generateImage(basePrompt())).rejects.toThrow('Imagen prediction failed')
    expect(usageRecorder.record).not.toHaveBeenCalled()
  })
})
