import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { computeAspectRatio } from './imageAspectRatio.js'

function image(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 100, g: 100, b: 100 } } }).png().toBuffer()
}

describe('computeAspectRatio', () => {
  it('returns width/height for a square image', async () => {
    expect(await computeAspectRatio(await image(100, 100))).toBe(1)
  })

  it('returns width/height for a panoramic image (very wide)', async () => {
    expect(await computeAspectRatio(await image(240, 100))).toBe(2.4)
  })

  it('returns width/height for a very tall image', async () => {
    expect(await computeAspectRatio(await image(50, 100))).toBe(0.5)
  })

  it('returns null for a buffer sharp cannot decode', async () => {
    expect(await computeAspectRatio(Buffer.from('not an image'))).toBeNull()
  })
})
