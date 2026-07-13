'use client'

import { TEMPLATE_STYLE_LABELS, type TemplateStyle } from '@socialshelf/domain'
import { TemplateStyleThumbnail } from './TemplateStyleThumbnail'

interface StylePreferenceRankingProps {
  values: TemplateStyle[]
  onChange: (values: TemplateStyle[]) => void
  primaryColor: string
}

// Lista ordenada com setas pra cima/baixo em vez de drag-and-drop — mesmo resultado (uma
// permutação completa dos 4 TemplateStyle) sem depender de biblioteca nova. A ordem em si não
// decide sozinha qual estilo cada post usa: é a preferência que a IA considera, junto com o
// assunto de cada pauta, no tick de autonomia (TopicAutonomyMatcherPort).
export function StylePreferenceRanking({ values, onChange, primaryColor }: StylePreferenceRankingProps) {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= values.length) return
    const next = [...values]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange(next)
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">Ordem de preferência de estilo do card</p>
      <p className="mb-2 text-xs text-muted-2">
        A IA escolhe, dentro desta ordem, o estilo que combina melhor com o assunto de cada post — não é sempre
        o primeiro da lista.
      </p>
      <ol className="space-y-1.5">
        {values.map((style, index) => (
          <li
            key={style}
            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-2 px-3 py-2 text-sm text-ink"
          >
            <span className="flex items-center gap-3">
              <TemplateStyleThumbnail style={style} primaryColor={primaryColor} />
              <span>
                <span className="mr-2 text-muted-2">{index + 1}º</span>
                {TEMPLATE_STYLE_LABELS[style]}
              </span>
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${TEMPLATE_STYLE_LABELS[style]}`}
                className="rounded-md border border-line px-2 py-1 text-xs text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === values.length - 1}
                aria-label={`Descer ${TEMPLATE_STYLE_LABELS[style]}`}
                className="rounded-md border border-line px-2 py-1 text-xs text-ink disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
