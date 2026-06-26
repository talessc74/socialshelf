import sharp from 'sharp'
import { TemplateStyle } from '@socialshelf/domain'
import type { TemplateRendererPort, TemplateRenderInput, RenderedTemplateImage } from '@socialshelf/domain'

const CHARS_PER_LINE = 32
const CHARS_PER_LINE_BODY = 50
const DEFAULT_DARK = '#1a1a1a'

// Piso de legibilidade: abaixo desta escala a fonte fica pequena demais para um card social,
// então a partir daqui o excesso de texto passa a ser cortado (truncateLines), não mais encolhido.
const MIN_FONT_SCALE = 0.55
const FONT_SCALE_STEP = 0.92

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function wrapText(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const rawWord of words) {
    // Uma palavra (ou URL colada) maior que o limite é quebrada à força — sem isso ela vaza
    // horizontalmente da imagem, já que o wrap normal só atua entre palavras.
    const pieces = rawWord.length > charsPerLine ? splitLongWord(rawWord, charsPerLine) : [rawWord]
    for (const word of pieces) {
      const candidate = current ? `${current} ${word}` : word
      if (candidate.length > charsPerLine && current) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
  }
  if (current) lines.push(current)

  return lines
}

function splitLongWord(word: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < word.length; i += chunkSize) {
    chunks.push(word.slice(i, i + chunkSize))
  }
  return chunks
}

function truncateLines(lines: string[], maxLines: number): string[] {
  if (maxLines <= 0) return []
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/\s+$/, '')}…`
  return kept
}

function blockHeightFor(
  headlineLineCount: number,
  bodyLineCount: number,
  fontSize: number,
  bodyFontSize: number,
): number {
  const lineHeight = fontSize * 1.2
  const bodyLineHeight = bodyFontSize * 1.2
  const gap = bodyLineCount > 0 ? fontSize * 0.7 : 0
  return headlineLineCount * lineHeight + gap + bodyLineCount * bodyLineHeight
}

export interface FittedText {
  fontSize: number
  bodyFontSize: number
  lines: string[]
  bodyLines: string[]
  blockHeight: number
}

// Garante que headline + body sempre cabem em `maxBlockHeight`: primeiro encolhe a fonte
// proporcionalmente (mais caracteres por linha, menos linhas) até o piso de legibilidade: depois,
// se ainda não couber, corta linhas (corpo primeiro, depois headline) e marca o corte com "…".
// É isso que impede o texto de vazar para fora da área (ou da própria imagem) quando o usuário
// digita um headline/body mais longo do que o template foi pensado para acomodar.
export function fitTextBlock(
  headline: string,
  body: string | null | undefined,
  baseFontSize: number,
  baseBodyFontSize: number,
  baseCharsPerLine: number,
  baseCharsPerLineBody: number,
  maxBlockHeight: number,
): FittedText {
  const hasBody = !!(body && body.trim().length > 0)
  let scale = 1
  let fontSize = baseFontSize
  let bodyFontSize = baseBodyFontSize
  let lines = wrapText(headline, baseCharsPerLine)
  let bodyLines = hasBody ? wrapText(body!, baseCharsPerLineBody) : []

  while (
    blockHeightFor(lines.length, bodyLines.length, fontSize, bodyFontSize) > maxBlockHeight &&
    scale > MIN_FONT_SCALE
  ) {
    scale = Math.max(MIN_FONT_SCALE, scale * FONT_SCALE_STEP)
    fontSize = Math.round(baseFontSize * scale)
    bodyFontSize = Math.round(baseBodyFontSize * scale)
    lines = wrapText(headline, Math.round(baseCharsPerLine / scale))
    bodyLines = hasBody ? wrapText(body!, Math.round(baseCharsPerLineBody / scale)) : []
  }

  const lineHeight = fontSize * 1.2
  const bodyLineHeight = bodyFontSize * 1.2
  const gap = bodyLines.length > 0 ? fontSize * 0.7 : 0

  const maxBodyLines =
    bodyLines.length > 0
      ? Math.max(0, Math.floor((maxBlockHeight - lines.length * lineHeight - gap) / bodyLineHeight))
      : 0
  bodyLines = truncateLines(bodyLines, maxBodyLines)

  const remainingForHeadline = maxBlockHeight - (bodyLines.length > 0 ? bodyLines.length * bodyLineHeight + gap : 0)
  const maxHeadlineLines = Math.max(1, Math.floor(remainingForHeadline / lineHeight))
  lines = truncateLines(lines, maxHeadlineLines)

  return {
    fontSize,
    bodyFontSize,
    lines,
    bodyLines,
    blockHeight: blockHeightFor(lines.length, bodyLines.length, fontSize, bodyFontSize),
  }
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

const LOGO_MARGIN_RATIO = 0.03
const LOGO_SIZE_RATIO = 0.045

function bodyTextElement(bodyLines: string[], bodyY: number, x: string, bodyFontSize: number, fontFamily: string): string {
  if (bodyLines.length === 0) return ''
  return `<text x="${x}" y="${bodyY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" fill-opacity="0.85" font-weight="normal" font-size="${bodyFontSize}" font-family="${fontFamily}">${buildTspans(bodyLines, bodyFontSize)}</text>`
}

function boldBottom(
  input: TemplateRenderInput,
  width: number,
  height: number,
  fontSize: number,
  bodyFontSize: number,
  fontFamily: string,
): string {
  const hasBody = !!(input.body && input.body.trim().length > 0)
  const minStripHeight = height * (hasBody ? 0.4 : 0.25)
  // Teto duro: a faixa nunca toma mais que isso da imagem, mesmo com texto muito longo —
  // a partir daqui fitTextBlock passa a encolher a fonte e, por fim, truncar.
  const maxStripHeight = height * 0.62
  const fitPadding = fontSize * 1.6

  const fitted = fitTextBlock(
    input.headline,
    input.body,
    fontSize,
    bodyFontSize,
    CHARS_PER_LINE,
    CHARS_PER_LINE_BODY,
    maxStripHeight - fitPadding,
  )
  const stripHeight = Math.min(maxStripHeight, Math.max(minStripHeight, fitted.blockHeight + fitPadding))
  const stripY = height - stripHeight
  const fill = input.brandTokens?.primaryColor ?? DEFAULT_DARK
  const { headlineY, bodyY } = stackedBlockYs(
    stripY + stripHeight / 2,
    fitted.lines.length,
    fitted.bodyLines.length,
    fitted.fontSize,
    fitted.bodyFontSize,
  )

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
    <text x="50%" y="${headlineY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fitted.fontSize}" font-family="${fontFamily}">${buildTspans(fitted.lines, fitted.fontSize)}</text>
    ${bodyTextElement(fitted.bodyLines, bodyY, '50%', fitted.bodyFontSize, fontFamily)}
  </svg>`
}

function centeredOverlay(
  input: TemplateRenderInput,
  width: number,
  height: number,
  fontSize: number,
  bodyFontSize: number,
  fontFamily: string,
): string {
  // Teto duro: a faixa central nunca toma mais que isso da imagem, mesmo com texto muito longo.
  const maxBandHeight = height * 0.85
  const fitPadding = fontSize * 2.8

  const fitted = fitTextBlock(
    input.headline,
    input.body,
    fontSize,
    bodyFontSize,
    CHARS_PER_LINE,
    CHARS_PER_LINE_BODY,
    maxBandHeight - fitPadding,
  )
  const { headlineY, bodyY } = stackedBlockYs(
    height / 2,
    fitted.lines.length,
    fitted.bodyLines.length,
    fitted.fontSize,
    fitted.bodyFontSize,
  )

  // Em vez de escurecer a imagem inteira (o que matava a foto), desenhamos só uma faixa
  // contida atrás do bloco de texto, com bordas suavizadas (feather) por gradiente. A foto
  // fica totalmente visível acima e abaixo do texto.
  const bandHeight = Math.min(maxBandHeight, fitted.blockHeight + fitPadding)
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
    <text x="50%" y="${headlineY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fitted.fontSize}" font-family="${fontFamily}">${buildTspans(fitted.lines, fitted.fontSize)}</text>
    ${bodyTextElement(fitted.bodyLines, bodyY, '50%', fitted.bodyFontSize, fontFamily)}
  </svg>`
}

function topStrip(
  input: TemplateRenderInput,
  width: number,
  height: number,
  fontSize: number,
  bodyFontSize: number,
  fontFamily: string,
): string {
  const hasBody = !!(input.body && input.body.trim().length > 0)
  const minStripHeight = height * (hasBody ? 0.32 : 0.2)
  // Teto duro: a faixa nunca toma mais que isso da imagem, mesmo com texto muito longo —
  // a partir daqui fitTextBlock passa a encolher a fonte e, por fim, truncar.
  const maxStripHeight = height * 0.55
  const fitPadding = fontSize * 1.6
  const fill = input.brandTokens?.secondaryColor ?? DEFAULT_DARK

  // O logo fica fixo no canto superior esquerdo (ver render()); reservamos essa faixa horizontal
  // para o texto, centralizado, não nascer atrás do selo do logo.
  const logoFootprint = input.logoImage
    ? Math.round(Math.min(width, height) * LOGO_SIZE_RATIO) + Math.round(Math.min(width, height) * LOGO_MARGIN_RATIO) * 2
    : 0
  const textAreaX = logoFootprint
  const textCenterX = textAreaX + (width - textAreaX) / 2

  const fitted = fitTextBlock(
    input.headline,
    input.body,
    fontSize,
    bodyFontSize,
    CHARS_PER_LINE,
    CHARS_PER_LINE_BODY,
    maxStripHeight - fitPadding,
  )
  const stripHeight = Math.min(maxStripHeight, Math.max(minStripHeight, fitted.blockHeight + fitPadding))
  const { headlineY, bodyY } = stackedBlockYs(
    stripHeight / 2,
    fitted.lines.length,
    fitted.bodyLines.length,
    fitted.fontSize,
    fitted.bodyFontSize,
  )

  // Gradiente descendente: opaco no topo, dissolvendo na foto na base — a imagem vaza por
  // baixo do texto em vez de ser cortada por uma faixa sólida.
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${fill}" stop-opacity="0.96" />
        <stop offset="68%" stop-color="${fill}" stop-opacity="0.85" />
        <stop offset="100%" stop-color="${fill}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${width}" height="${stripHeight}" fill="url(#scrim)" />
    <text x="${textCenterX}" y="${headlineY}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-weight="bold" font-size="${fitted.fontSize}" font-family="${fontFamily}">${buildTspans(fitted.lines, fitted.fontSize)}</text>
    ${bodyTextElement(fitted.bodyLines, bodyY, `${textCenterX}`, fitted.bodyFontSize, fontFamily)}
  </svg>`
}

export function buildSvg(input: TemplateRenderInput, width: number, height: number): string {
  const fontSize = Math.round(width * 0.045)
  const bodyFontSize = Math.round(fontSize * 0.7)
  // Fontes customizadas são fase futura (conforme ADR) — sans-serif fixo por enquanto, mapeado para a fonte
  // disponível no container via fontconfig.
  const fontFamily = 'sans-serif'

  switch (input.style) {
    case TemplateStyle.BOLD_BOTTOM:
      return boldBottom(input, width, height, fontSize, bodyFontSize, fontFamily)
    case TemplateStyle.CENTERED_OVERLAY:
      return centeredOverlay(input, width, height, fontSize, bodyFontSize, fontFamily)
    case TemplateStyle.TOP_STRIP:
      return topStrip(input, width, height, fontSize, bodyFontSize, fontFamily)
    case TemplateStyle.NO_TEXT:
      // Nunca chega aqui — render() já filtra NO_TEXT antes de chamar buildSvg().
      return ''
  }
}

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
      const svg = buildSvg(input, width, height)
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
}
