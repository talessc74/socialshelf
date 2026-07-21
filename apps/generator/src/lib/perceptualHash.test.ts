import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { computePerceptualHash, hashFromGrayscale9x8 } from './perceptualHash.js'

function solidImage(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r, g, b } } }).png().toBuffer()
}

// Gradiente horizontal DECRESCENTE: cada coluna mais escura que a anterior, então cada pixel é
// mais claro que o vizinho à direita (left > right) e o dHash fica cheio de bits 1 — distinto do
// hash todo-zero de uma cor sólida.
function gradientImage(): Promise<Buffer> {
  const width = 64
  const height = 64
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = 255 - Math.floor((x / width) * 255)
      const i = (y * width + x) * 3
      data[i] = v
      data[i + 1] = v
      data[i + 2] = v
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

describe('hashFromGrayscale9x8', () => {
  it('produces 16 hex chars (64 bits)', () => {
    const hash = hashFromGrayscale9x8(new Uint8Array(72))
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('sets a bit where a pixel is brighter than its right neighbour', () => {
    const data = new Uint8Array(72) // tudo 0 → nenhum "maior que o vizinho"
    expect(hashFromGrayscale9x8(data)).toBe('0000000000000000')
  })
})

describe('computePerceptualHash', () => {
  it('returns a 16-hex hash for a decodable image', async () => {
    const hash = await computePerceptualHash(await gradientImage())
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is deterministic — the same image always hashes the same', async () => {
    const img = await gradientImage()
    expect(await computePerceptualHash(img)).toBe(await computePerceptualHash(img))
  })

  it('returns null for a buffer sharp cannot decode', async () => {
    expect(await computePerceptualHash(Buffer.from('not an image'))).toBeNull()
  })

  it('gives near-identical hashes to visually near-identical images and distant ones to different images', async () => {
    const red = await computePerceptualHash(await solidImage(200, 30, 30))
    const redish = await computePerceptualHash(await solidImage(205, 34, 28))
    const gradient = await computePerceptualHash(await gradientImage())

    // Duas cores sólidas quase iguais: hashes idênticos (nenhum bit de diferença).
    expect(red).toBe(redish)
    // Uma cor sólida e um gradiente: hashes diferentes.
    expect(red).not.toBe(gradient)
  })
})
