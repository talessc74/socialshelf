import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AspectRatio, TemplateStyle } from '@socialshelf/domain'
import type { AiUsageRecorderPort, ImagePrompt } from '@socialshelf/domain'

const generateContent = vi.fn()

const { FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { FakeApiError }
})

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
  ApiError: FakeApiError,
}))

import { GeminiImageGenerator } from './GeminiImageGenerator.js'

function respondWithImage(overrides: { data?: string; mimeType?: string } = {}) {
  generateContent.mockResolvedValueOnce({
    candidates: [
      {
        content: {
          parts: [{ inlineData: { data: overrides.data ?? 'YmFzZTY0', mimeType: overrides.mimeType ?? 'image/png' } }],
        },
      },
    ],
  })
}

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

describe('GeminiImageGenerator', () => {
  let usageRecorder: AiUsageRecorderPort & { record: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    generateContent.mockReset()
    usageRecorder = { record: vi.fn().mockResolvedValue(undefined) }
  })

  it('devolve a imagem gerada e registra o uso, com o custo estimado por imagem, atribuída à marca certa', async () => {
    respondWithImage()
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    const image = await generator.generateImage(basePrompt())

    expect(image).toEqual({ base64: 'YmFzZTY0', mimeType: 'image/png' })
    expect(usageRecorder.record).toHaveBeenCalledWith({
      userId: 'user-1',
      brandId: 'brand-1',
      category: 'image-generation',
      operation: 'imagen-generation',
      model: 'gemini-2.5-flash-image',
      imageCount: 1,
      estimatedCostUsd: 0.04,
    })
  })

  it('pede a proporção de aspecto do prompt via imageConfig.aspectRatio', async () => {
    respondWithImage()
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    await generator.generateImage(basePrompt())

    const call = generateContent.mock.calls[0]![0] as { config: { responseModalities: string[]; imageConfig: { aspectRatio: string } } }
    expect(call.config.responseModalities).toEqual(['Image'])
    expect(call.config.imageConfig.aspectRatio).toBe(AspectRatio.SQUARE)
  })

  it('lança quando o modelo não devolve nenhuma imagem entre as parts', async () => {
    generateContent.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'desculpe, não consigo gerar isso' }] } }] })
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    await expect(generator.generateImage(basePrompt())).rejects.toThrow('Gemini returned no image data')
    expect(usageRecorder.record).not.toHaveBeenCalled()
  })

  it('não registra uso quando a chamada falha', async () => {
    generateContent.mockRejectedValueOnce(new Error('boom'))
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    await expect(generator.generateImage(basePrompt())).rejects.toThrow('boom')
    expect(usageRecorder.record).not.toHaveBeenCalled()
  })

  it('tenta de novo em 429 RESOURCE_EXHAUSTED e devolve a imagem quando uma tentativa seguinte funciona', async () => {
    vi.useFakeTimers()
    generateContent
      .mockRejectedValueOnce(new FakeApiError(429, 'Resource exhausted'))
      .mockResolvedValueOnce({
        candidates: [{ content: { parts: [{ inlineData: { data: 'YmFzZTY0', mimeType: 'image/png' } }] } }],
      })
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    const resultPromise = generator.generateImage(basePrompt())
    await vi.runAllTimersAsync()
    const image = await resultPromise

    expect(image).toEqual({ base64: 'YmFzZTY0', mimeType: 'image/png' })
    expect(generateContent).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('lança o 429 depois de esgotar as tentativas', async () => {
    vi.useFakeTimers()
    generateContent.mockRejectedValue(new FakeApiError(429, 'Resource exhausted'))
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    const resultPromise = generator.generateImage(basePrompt())
    const assertion = expect(resultPromise).rejects.toThrow('Resource exhausted')
    await vi.runAllTimersAsync()
    await assertion

    expect(generateContent).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })

  it('não tenta de novo em um erro que não seja 429 (ex.: prompt rejeitado)', async () => {
    generateContent.mockRejectedValueOnce(new FakeApiError(400, 'prompt rejected'))
    const generator = new GeminiImageGenerator('project-1', 'us-central1', 'gemini-2.5-flash-image', usageRecorder)

    await expect(generator.generateImage(basePrompt())).rejects.toThrow('prompt rejected')
    expect(generateContent).toHaveBeenCalledTimes(1)
  })
})
