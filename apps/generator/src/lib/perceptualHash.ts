import sharp from 'sharp'

// dHash (difference hash) perceptual: reduz a imagem a 9x8 tons de cinza e compara cada pixel
// com o vizinho à direita, gerando 64 bits (8 linhas x 8 comparações). Duas fotos quase-iguais
// produzem hashes com pouquíssimos bits diferentes (distância de Hamming baixa), enquanto fotos
// distintas divergem muito. Determinístico e barato — não depende de IA (jurisdição RiverRaid).
export async function computePerceptualHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .removeAlpha()
      .grayscale()
      .resize(9, 8, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    return hashFromGrayscale9x8(data)
  } catch {
    // Formato que o sharp não decodifica não derruba o upload — a foto só fica sem hash e
    // nunca é tratada como quase-igual de nenhuma outra.
    return null
  }
}

// Recebe os 72 bytes (9 colunas x 8 linhas) de tons de cinza e devolve 16 hex (64 bits).
// Separado de computePerceptualHash pra ser testável sem depender do decode do sharp.
export function hashFromGrayscale9x8(data: Uint8Array): string {
  let bits = ''
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col] ?? 0
      const right = data[row * 9 + col + 1] ?? 0
      bits += left > right ? '1' : '0'
    }
  }
  let hex = ''
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}
