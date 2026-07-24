import sharp from 'sharp'

// Razão largura/altura da imagem original — barato de calcular (sharp lê só o cabeçalho pra
// metadata(), não decodifica os pixels). Usado pra detectar fotos de campanha panorâmicas/muito
// verticais que a Graph API do Instagram rejeita antes mesmo de tentar publicar.
export async function computeAspectRatio(buffer: Buffer): Promise<number | null> {
  try {
    const { width, height } = await sharp(buffer).metadata()
    if (!width || !height) return null
    return width / height
  } catch {
    // Formato que o sharp não decodifica não derruba o upload — a foto só fica sem o dado e
    // nunca é tratada como incompatível com nenhuma rede.
    return null
  }
}
