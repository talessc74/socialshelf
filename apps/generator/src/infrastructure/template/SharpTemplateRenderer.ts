import sharp from 'sharp'
import { TemplateStyle } from '@socialshelf/domain'
import type { TemplateRendererPort, TemplateRenderInput, RenderedTemplateImage } from '@socialshelf/domain'

const CHARS_PER_LINE = 32
const CHARS_PER_LINE_BODY = 50
const DEFAULT_DARK = '#1a1a1a'

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > charsPerLine && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)

  return lines
}

function buildTspans(lines: string[], fontSize: number): string {
  return lines
    .map((line, i) => `<tspan x="50%" dy="${i === 0 ? 0 : fontSize * 1.2}">${escapeXml(line)}</tspan>`)
    .join('')
}

// Posiciona dois blocos de texto (headline + body) empilhados e centralizados como uma unidade
// em torno de `centerY`, preservando o truque de centralização vertical de buildTspans/dominant-baseline:
// cada Y retornado é o centro do próprio bloco, não o topo.
function stackedBlockYs(
  centerY: number,
  headlineLineCount: number,
  bodyLineCount: number,
  fontSize: number,
  bodyFontSize: number,
): { headlineY: number; bodyY: number } {
  const lineHeight = fontSize * 1.2
  const bodyLineHeight = bodyFontSize * 1.2
  const headlineBlockHeight = headlineLineCount * lineHeight
  const gap = bodyLineCount > 0 ? fontSize * 0.7 : 0
  const bodyBlockHeight = bodyLineCount * bodyLineHeight
  const topY = centerY - (headlineBlockHeight + gap + bodyBlockHeight) / 2
  return {
    headlineY: topY + lineHeight / 2,
    bodyY: topY + headlineBlockHeight + gap + bodyLineHeight / 2,
  }
}

const LOGO_MARGIN_RATIO = 0.04
const LOGO_SIZE_RATIO = 0.06

export class SharpTemplateRenderer implements TemplateRendererPort {
  async render(input: TemplateRenderInput): Promise<RenderedTemplateImage> {
    const backgroundBuffer = Buffer.from(input.backgroundImage.base64, 'base64')
    const background = sharp(backgroundBuffer)
    const metadata = await background.metadata()
    const width = metadata.width ?? 1024
    const height = metadata.height ?? 1024

    const overlays: Array<{ input: Buffer; top: number; left: number }> = []

    // A barra de texto não é obrigatória: o estilo `no-text` é uma escolha deliberada do
    // usuário pela foto pura, e sem headline não há nada para desenhar de qualquer forma —
    // forçar a barra nesses casos deixaria uma faixa colorida vazia sobre a foto sem propósito.
    if (input.style !== TemplateStyle.NO_TEXT && input.headline.trim().length > 0) {
      const svg = this.buildSvg(input, width, height)
      overlays.push({ input: Buffer.from(svg), top: 0, left: 0 })
    }

    if (input.logoImage) {
      const logoBadge = await this.buildLogoBadge(input.logoImage, width, height)
      const margin = Math.round(Math.min(width, height) * LOGO_MARGIN_RATIO)
      // Posição fixa — sempre no canto superior esquerdo, mesmo formato e tamanho em todo card.
      overlays.push({ input: logoBadge, top: margin, left: margin })
    }

    const composed = await background.composite(overlays).png().toBuffer()

    return { base64: composed.toString('base64'), mimeType: 'image/png' }
  }

  private async buildLogoBadge(
    logoImage: { base64: string; mimeType: string },
    width: number,
    height: number,
  ): Promise<Buffer> {
    const logoSize = Math.round(Math.min(width, height) * LOGO_SIZE_RATIO)

    const circleMask = Buffer.from(
      `<svg width="${logoSize}" height="${logoSize}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" fill="#ffffff" />
      </svg>`,
    )

    // trim() remove a margem vazia/transparente ao redor da marca antes de centralizar, e
    // fit: 'cover' faz a marca preencher todo o quadrado (recorta o excedente em vez de
    // encolher para caber, que era o que deixava a margem branca visível). dest-in recorta
    // esse quadrado no formato circular — sem isso o quadrado cobriria o círculo por completo.
    return sharp(Buffer.from(logoImage.base64, 'base64'))
      .trim()
      .resize(logoSize, logoSize, { fit: 'cover' })
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer()
  }

  private buildSvg(input: TemplateRenderInput, width: number, height: number): string {
    const fontSize = Math.round(width * 0.045)
    const bodyFontSize = Math.round(fontSize * 0.55)
    const lines = wrapText(input.headline, CHARS_PER_LINE)
    const bodyLines = input.body && input.body.trim().length > 0 ? wrapText(input.body, CHARS_PER_LINE_BODY) : []
    // Fontes customizadas são fase futura (conforme ADR) — sans-serif fixo por enquanto, mapeado para a fonte
    // disponível no container via fontconfig.
    const fontFamily = 'sans-serif'

    switch (input.style) {
      case TemplateStyle.BOLD_BOTTOM:
        return this.boldBottom(input, width, height, fontSize, bodyFontSize, fontFamily, lines, bodyLines)
      case TemplateStyle.CENTERED_OVERLAY:
        return this.centeredOverlay(input, width, height, fontSize, bodyFontSize, fontFamily, lines, bodyLines)
      case TemplateStyle.TOP_STRIP:
        return this.topStrip(input, width, height, fontSize, bodyFontSize, fontFamily, lines, bodyLines)
      case TemplateStyle.NO_TEXT:
        // Nunca chega aqui — render() já filtra NO_TEXT antes de chamar buildSvg().
        return ''
    }
  }

  private bodyTextElement(bodyLines: string[], bodyY: number, x: string, bodyFontSize: number, fontFamily: string): string {
    if (bodyLines.length === 0) return ''
    return `<text x="${x}" y="${bodyY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" fill-opacity="0.85" font-weight="normal" font-size="${bodyFontSize}" font-family="${fontFamily}">${buildTspans(bodyLines, bodyFontSize)}</text>`
  }

  private boldBottom(
    input: TemplateRenderInput,
    width: number,
    height: number,
    fontSize: number,
    bodyFontSize: number,
    fontFamily: string,
    lines: string[],
    bodyLines: string[],
  ): string {
    const stripHeight = bodyLines.length > 0 ? height * 0.4 : height * 0.25
    const stripY = height - stripHeight
    const fill = input.brandTokens?.primaryColor ?? DEFAULT_DARK
    const { headlineY, bodyY } = stackedBlockYs(stripY + stripHeight / 2, lines.length, bodyLines.length, fontSize, bodyFontSize)

    // Gradiente em vez de retângulo chapado: a faixa começa transparente no topo e ganha
    // opacidade até a base, deixando a foto vazar por trás do texto em vez de ser amputada
    // por um bloco sólido. O texto fica centralizado na metade de baixo, onde a cor já está
    // densa o suficiente para garantir contraste com o branco.
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${fill}" stop-opacity="0" />
          <stop offset="32%" stop-color="${fill}" stop-opacity="0.85" />
          <stop offset="100%" stop-color="${fill}" stop-opacity="0.96" />
        </linearGradient>
      </defs>
      <rect x="0" y="${stripY}" width="${width}" height="${stripHeight}" fill="url(#scrim)" />
      <text x="50%" y="${headlineY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fontSize}" font-family="${fontFamily}">${buildTspans(lines, fontSize)}</text>
      ${this.bodyTextElement(bodyLines, bodyY, '50%', bodyFontSize, fontFamily)}
    </svg>`
  }

  private centeredOverlay(
    input: TemplateRenderInput,
    width: number,
    height: number,
    fontSize: number,
    bodyFontSize: number,
    fontFamily: string,
    lines: string[],
    bodyLines: string[],
  ): string {
    const { headlineY, bodyY } = stackedBlockYs(height / 2, lines.length, bodyLines.length, fontSize, bodyFontSize)

    // Em vez de escurecer a imagem inteira (o que matava a foto), desenhamos só uma faixa
    // contida atrás do bloco de texto, com bordas suavizadas (feather) por gradiente. A foto
    // fica totalmente visível acima e abaixo do texto.
    const lineHeight = fontSize * 1.2
    const bodyLineHeight = bodyFontSize * 1.2
    const gap = bodyLines.length > 0 ? fontSize * 0.7 : 0
    const blockHeight = lines.length * lineHeight + gap + bodyLines.length * bodyLineHeight
    const bandHeight = blockHeight + fontSize * 2.8
    const bandY = height / 2 - bandHeight / 2

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0" />
          <stop offset="22%" stop-color="#000000" stop-opacity="0.55" />
          <stop offset="78%" stop-color="#000000" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="${bandY}" width="${width}" height="${bandHeight}" fill="url(#scrim)" />
      <text x="50%" y="${headlineY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fontSize}" font-family="${fontFamily}">${buildTspans(lines, fontSize)}</text>
      ${this.bodyTextElement(bodyLines, bodyY, '50%', bodyFontSize, fontFamily)}
    </svg>`
  }

  private topStrip(
    input: TemplateRenderInput,
    width: number,
    height: number,
    fontSize: number,
    bodyFontSize: number,
    fontFamily: string,
    lines: string[],
    bodyLines: string[],
  ): string {
    const stripHeight = bodyLines.length > 0 ? height * 0.32 : height * 0.2
    const fill = input.brandTokens?.secondaryColor ?? DEFAULT_DARK
    // Gradiente descendente: opaco no topo, dissolvendo na foto na base — a imagem vaza por
    // baixo do texto em vez de ser cortada por uma faixa sólida.

    // O logo fica fixo no canto superior esquerdo (ver render()); reservamos essa faixa horizontal
    // para o texto, centralizado, não nascer atrás do selo do logo.
    const logoFootprint = input.logoImage
      ? Math.round(Math.min(width, height) * LOGO_SIZE_RATIO) + Math.round(Math.min(width, height) * LOGO_MARGIN_RATIO) * 2
      : 0
    const textAreaX = logoFootprint
    const textCenterX = textAreaX + (width - textAreaX) / 2
    const { headlineY, bodyY } = stackedBlockYs(stripHeight / 2, lines.length, bodyLines.length, fontSize, bodyFontSize)

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${fill}" stop-opacity="0.96" />
          <stop offset="68%" stop-color="${fill}" stop-opacity="0.85" />
          <stop offset="100%" stop-color="${fill}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${stripHeight}" fill="url(#scrim)" />
      <text x="${textCenterX}" y="${headlineY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fontSize}" font-family="${fontFamily}">${buildTspans(lines, fontSize)}</text>
      ${this.bodyTextElement(bodyLines, bodyY, `${textCenterX}`, bodyFontSize, fontFamily)}
    </svg>`
  }
}
