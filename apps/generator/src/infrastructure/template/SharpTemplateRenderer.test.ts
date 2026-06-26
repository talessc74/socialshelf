import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { TemplateStyle } from '@socialshelf/domain'
import type { TemplateRenderInput } from '@socialshelf/domain'
import { wrapText, fitTextBlock, buildSvg, SharpTemplateRenderer } from './SharpTemplateRenderer.js'

function baseInput(overrides: Partial<TemplateRenderInput> = {}): TemplateRenderInput {
  return {
    backgroundImage: { base64: '', mimeType: 'image/png' },
    headline: 'Headline curto',
    body: null,
    style: TemplateStyle.BOLD_BOTTOM,
    brandTokens: null,
    logoImage: null,
    ...overrides,
  }
}

// Extrai y/height de <rect ...> e o conteúdo de cada <text y="...">; o SVG é gerado por
// template string simples (sem parser real), então regex direta é suficiente e mais legível
// que subir um parser XML só para os testes.
function rectBounds(svg: string): { y: number; height: number } {
  const match = svg.match(/<rect[^>]*\sy="([\d.-]+)"[^>]*\sheight="([\d.]+)"/)
  if (!match) throw new Error('rect não encontrado no SVG')
  return { y: Number(match[1]), height: Number(match[2]) }
}

function textYs(svg: string): number[] {
  return [...svg.matchAll(/<text[^>]*\sy="([\d.-]+)"/g)].map((m) => Number(m[1]))
}

describe('wrapText', () => {
  it('quebra por palavras respeitando o limite de caracteres', () => {
    expect(wrapText('uma frase razoavelmente curta', 15)).toEqual(['uma frase', 'razoavelmente', 'curta'])
  })

  it('quebra à força uma palavra única maior que o limite (ex: URL colada)', () => {
    const longWord = 'https://exemplo.com/caminho/muito/longo/sem/espacos/nenhum'
    const lines = wrapText(longWord, 20)
    expect(lines.every((l) => l.length <= 20)).toBe(true)
    expect(lines.join('')).toBe(longWord)
  })
})

describe('fitTextBlock', () => {
  it('mantém a fonte original quando o texto já cabe na altura disponível', () => {
    const fitted = fitTextBlock('Título curto', 'corpo breve', 40, 28, 32, 50, 1000)
    expect(fitted.fontSize).toBe(40)
    expect(fitted.bodyFontSize).toBe(28)
    expect(fitted.lines).toEqual(['Título curto'])
  })

  it('encolhe a fonte proporcionalmente quando o bloco de texto não cabe', () => {
    const longBody =
      'Este é um parágrafo de apoio bem mais longo do que o template foi originalmente pensado para acomodar, ' +
      'com várias frases encadeadas para forçar a quebra em muitas linhas dentro da faixa do card.'
    const fitted = fitTextBlock('Headline normal', longBody, 40, 28, 32, 50, 200)

    expect(fitted.fontSize).toBeLessThan(40)
    expect(fitted.blockHeight).toBeLessThanOrEqual(200 + 1e-6)
  })

  it('trunca com "…" quando mesmo na menor fonte legível o texto não cabe', () => {
    const veryLongBody = Array.from({ length: 30 }, (_, i) => `frase numero ${i}`).join(' ')
    const fitted = fitTextBlock('Headline', veryLongBody, 40, 28, 32, 50, 80)

    expect(fitted.blockHeight).toBeLessThanOrEqual(80 + 1e-6)
    expect(fitted.bodyLines[fitted.bodyLines.length - 1]).toMatch(/…$/)
  })

  it('nunca deixa o headline sem nenhuma linha, mesmo sob restrição extrema', () => {
    const fitted = fitTextBlock('Um headline qualquer', 'corpo', 40, 28, 32, 50, 1)
    expect(fitted.lines.length).toBeGreaterThanOrEqual(1)
  })
})

describe('buildSvg — contenção dentro dos limites da imagem', () => {
  const longBody =
    'E depois do problema, qual é o seu próximo passo? Este parágrafo descreve em detalhes um cenário ' +
    'hipotético bastante longo, do tipo que um usuário real pode digitar sem perceber que ultrapassa o ' +
    'espaço pensado originalmente para o card, testando assim o comportamento de ajuste automático de texto.'

  const styles = [TemplateStyle.BOLD_BOTTOM, TemplateStyle.TOP_STRIP, TemplateStyle.CENTERED_OVERLAY]

  for (const style of styles) {
    it(`${style}: a faixa/banda de texto nunca extrapola a altura da imagem com body longo`, () => {
      const width = 1080
      const height = 1080
      const svg = buildSvg(baseInput({ headline: 'E depois do problema? Seu próximo passo.', body: longBody, style }), width, height)

      const { y, height: rectHeight } = rectBounds(svg)
      expect(y).toBeGreaterThanOrEqual(-0.01)
      expect(y + rectHeight).toBeLessThanOrEqual(height + 0.01)

      for (const textY of textYs(svg)) {
        expect(textY).toBeGreaterThanOrEqual(0)
        expect(textY).toBeLessThanOrEqual(height)
      }
    })

    it(`${style}: textos e faixa cabem normalmente para headline curto sem body`, () => {
      const width = 1080
      const height = 1080
      const svg = buildSvg(baseInput({ headline: 'Promoção imperdível', body: null, style }), width, height)

      const { y, height: rectHeight } = rectBounds(svg)
      expect(y).toBeGreaterThanOrEqual(-0.01)
      expect(y + rectHeight).toBeLessThanOrEqual(height + 0.01)
    })
  }
})

describe('SharpTemplateRenderer.render — integração', () => {
  it('produz uma imagem PNG com as mesmas dimensões do fundo, mesmo com headline+body extensos', async () => {
    const width = 800
    const height = 800
    const background = await sharp({
      create: { width, height, channels: 3, background: { r: 10, g: 80, b: 90 } },
    })
      .png()
      .toBuffer()

    const renderer = new SharpTemplateRenderer()
    const result = await renderer.render(
      baseInput({
        backgroundImage: { base64: background.toString('base64'), mimeType: 'image/png' },
        headline: 'E depois do problema? Seu próximo passo.',
        body:
          'Um parágrafo bem mais longo do que o esperado, escrito por um usuário sem limite de caracteres, ' +
          'que precisa caber no card sem vazar para fora da imagem final composta pelo sharp.',
        style: TemplateStyle.BOLD_BOTTOM,
      }),
    )

    const outputMeta = await sharp(Buffer.from(result.base64, 'base64')).metadata()
    expect(outputMeta.width).toBe(width)
    expect(outputMeta.height).toBe(height)
  })
})
