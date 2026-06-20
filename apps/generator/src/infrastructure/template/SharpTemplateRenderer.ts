import sharp from 'sharp'
import { TemplateStyle } from '@socialshelf/domain'
import type { TemplateRendererPort, TemplateRenderInput, RenderedTemplateImage } from '@socialshelf/domain'

const CHARS_PER_LINE = 32
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

const LOGO_MARGIN_RATIO = 0.04
const LOGO_SIZE_RATIO = 0.12

export class SharpTemplateRenderer implements TemplateRendererPort {
  async render(input: TemplateRenderInput): Promise<RenderedTemplateImage> {
    const backgroundBuffer = Buffer.from(input.backgroundImage.base64, 'base64')
    const background = sharp(backgroundBuffer)
    const metadata = await background.metadata()
    const width = metadata.width ?? 1024
    const height = metadata.height ?? 1024

    const svg = this.buildSvg(input, width, height)
    const overlays: Array<{ input: Buffer; top: number; left: number }> = [
      { input: Buffer.from(svg), top: 0, left: 0 },
    ]

    if (input.logoImage) {
      const logoSize = Math.round(Math.min(width, height) * LOGO_SIZE_RATIO)
      const margin = Math.round(Math.min(width, height) * LOGO_MARGIN_RATIO)
      const logoBuffer = await sharp(Buffer.from(input.logoImage.base64, 'base64'))
        .resize(logoSize, logoSize, { fit: 'inside' })
        .toBuffer()
      overlays.push({ input: logoBuffer, top: height - logoSize - margin, left: width - logoSize - margin })
    }

    const composed = await background.composite(overlays).png().toBuffer()

    return { base64: composed.toString('base64'), mimeType: 'image/png' }
  }

  private buildSvg(input: TemplateRenderInput, width: number, height: number): string {
    const fontSize = Math.round(width * 0.045)
    const lines = wrapText(input.headline, CHARS_PER_LINE)
    // Fontes customizadas são fase futura (conforme ADR) — sans-serif fixo por enquanto, mapeado para a fonte
    // disponível no container via fontconfig.
    const fontFamily = 'sans-serif'

    switch (input.style) {
      case TemplateStyle.BOLD_BOTTOM:
        return this.boldBottom(input, width, height, fontSize, fontFamily, lines)
      case TemplateStyle.CENTERED_OVERLAY:
        return this.centeredOverlay(width, height, fontSize, fontFamily, lines)
      case TemplateStyle.TOP_STRIP:
        return this.topStrip(input, width, height, fontSize, fontFamily, lines)
    }
  }

  private boldBottom(
    input: TemplateRenderInput,
    width: number,
    height: number,
    fontSize: number,
    fontFamily: string,
    lines: string[],
  ): string {
    const stripHeight = height * 0.25
    const stripY = height - stripHeight
    const fill = input.brandTokens?.primaryColor ?? DEFAULT_DARK
    const textY = stripY + stripHeight / 2 - ((lines.length - 1) * fontSize * 1.2) / 2

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${stripY}" width="${width}" height="${stripHeight}" fill="${fill}" />
      <text x="50%" y="${textY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fontSize}" font-family="${fontFamily}">${buildTspans(lines, fontSize)}</text>
    </svg>`
  }

  private centeredOverlay(
    width: number,
    height: number,
    fontSize: number,
    fontFamily: string,
    lines: string[],
  ): string {
    const textY = height / 2 - ((lines.length - 1) * fontSize * 1.2) / 2

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="black" fill-opacity="0.45" />
      <text x="50%" y="${textY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fontSize}" font-family="${fontFamily}">${buildTspans(lines, fontSize)}</text>
    </svg>`
  }

  private topStrip(
    input: TemplateRenderInput,
    width: number,
    height: number,
    fontSize: number,
    fontFamily: string,
    lines: string[],
  ): string {
    const stripHeight = height * 0.2
    const fill = input.brandTokens?.secondaryColor ?? DEFAULT_DARK
    const textY = stripHeight / 2 - ((lines.length - 1) * fontSize * 1.2) / 2

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${stripHeight}" fill="${fill}" />
      <text x="50%" y="${textY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fontSize}" font-family="${fontFamily}">${buildTspans(lines, fontSize)}</text>
    </svg>`
  }
}
