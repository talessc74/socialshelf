import { describe, it, expect, vi, beforeEach } from 'vitest'

const generateContent = vi.fn()

vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({ generateContent }),
  })),
}))

import { GeminiCampaignCaptionWriter } from './GeminiCampaignCaptionWriter.js'

function respondWith(text: string) {
  generateContent.mockResolvedValueOnce({
    response: { candidates: [{ content: { parts: [{ text }] } }] },
  })
}

const baseInput = {
  coverImage: { base64: 'ZmFrZS1pbWFnZQ==', mimeType: 'image/jpeg' },
  campaignName: 'Viagem à Europa',
  campaignDescription: 'Registro da viagem em família',
  keywords: ['viagem', 'família'],
  brandBusiness: null,
  brandVoice: null,
}

describe('GeminiCampaignCaptionWriter', () => {
  beforeEach(() => {
    generateContent.mockReset()
  })

  it('sends the cover image as inlineData alongside the text prompt', async () => {
    respondWith(JSON.stringify({ caption: 'Um pôr do sol inesquecível em Paris' }))

    await new GeminiCampaignCaptionWriter('p', 'global', 'gemini-2.5-flash').write(baseInput)

    const call = generateContent.mock.calls[0]![0] as {
      contents: Array<{ parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
    }
    const parts = call.contents[0]!.parts
    expect(parts.some((p) => p.text?.includes('Viagem à Europa'))).toBe(true)
    expect(parts.some((p) => p.inlineData?.mimeType === 'image/jpeg' && p.inlineData.data === 'ZmFrZS1pbWFnZQ==')).toBe(
      true,
    )
  })

  it('returns the caption parsed from the model response', async () => {
    respondWith(JSON.stringify({ caption: 'Um pôr do sol inesquecível em Paris' }))

    const result = await new GeminiCampaignCaptionWriter('p', 'global', 'gemini-2.5-flash').write(baseInput)

    expect(result).toEqual({ caption: 'Um pôr do sol inesquecível em Paris' })
  })

  it('throws when the model returns invalid JSON', async () => {
    respondWith('not json at all')

    await expect(new GeminiCampaignCaptionWriter('p', 'global', 'gemini-2.5-flash').write(baseInput)).rejects.toThrow(
      'invalid JSON for campaign caption',
    )
  })

  it('throws when the model response is missing the caption field', async () => {
    respondWith(JSON.stringify({ notCaption: 'x' }))

    await expect(new GeminiCampaignCaptionWriter('p', 'global', 'gemini-2.5-flash').write(baseInput)).rejects.toThrow(
      'malformed campaign caption payload',
    )
  })

  it('throws when the model returns an empty caption', async () => {
    respondWith(JSON.stringify({ caption: '   ' }))

    await expect(new GeminiCampaignCaptionWriter('p', 'global', 'gemini-2.5-flash').write(baseInput)).rejects.toThrow(
      'malformed campaign caption payload',
    )
  })

  it('includes brand voice and business in the prompt when provided', async () => {
    respondWith(JSON.stringify({ caption: 'x' }))

    await new GeminiCampaignCaptionWriter('p', 'global', 'gemini-2.5-flash').write({
      ...baseInput,
      brandBusiness: { name: 'Rádio Kactus', segment: 'Media', description: '' },
      brandVoice: { tone: 'caloroso e direto', allowedVocabulary: ['galera'], prohibitedVocabulary: ['formal demais'] },
    })

    const call = generateContent.mock.calls[0]![0] as { contents: Array<{ parts: Array<{ text?: string }> }> }
    const text = call.contents[0]!.parts[0]!.text!
    expect(text).toContain('Rádio Kactus')
    expect(text).toContain('caloroso e direto')
    expect(text).toContain('formal demais')
  })
})
