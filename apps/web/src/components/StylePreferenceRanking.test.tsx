import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { TemplateStyle } from '@socialshelf/domain'
import { StylePreferenceRanking } from './StylePreferenceRanking'

const ALL_ORDER = [
  TemplateStyle.BOLD_BOTTOM,
  TemplateStyle.CENTERED_OVERLAY,
  TemplateStyle.TOP_STRIP,
  TemplateStyle.NO_TEXT,
]

describe('StylePreferenceRanking', () => {
  it('renders the styles in the given order with their rank number', () => {
    render(<StylePreferenceRanking values={ALL_ORDER} onChange={vi.fn()} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveTextContent('1º')
    expect(items[0]).toHaveTextContent('Faixa inferior')
    expect(items[3]).toHaveTextContent('4º')
    expect(items[3]).toHaveTextContent('Sem texto')
  })

  it('swaps with the previous item when moved up', () => {
    const onChange = vi.fn()
    render(<StylePreferenceRanking values={ALL_ORDER} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Subir Overlay escuro'))

    expect(onChange).toHaveBeenCalledWith([
      TemplateStyle.CENTERED_OVERLAY,
      TemplateStyle.BOLD_BOTTOM,
      TemplateStyle.TOP_STRIP,
      TemplateStyle.NO_TEXT,
    ])
  })

  it('swaps with the next item when moved down', () => {
    const onChange = vi.fn()
    render(<StylePreferenceRanking values={ALL_ORDER} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Descer Faixa inferior'))

    expect(onChange).toHaveBeenCalledWith([
      TemplateStyle.CENTERED_OVERLAY,
      TemplateStyle.BOLD_BOTTOM,
      TemplateStyle.TOP_STRIP,
      TemplateStyle.NO_TEXT,
    ])
  })

  it('disables the up arrow on the first item and the down arrow on the last item', () => {
    render(<StylePreferenceRanking values={ALL_ORDER} onChange={vi.fn()} />)

    expect(screen.getByLabelText('Subir Faixa inferior')).toBeDisabled()
    expect(screen.getByLabelText('Descer Sem texto')).toBeDisabled()
  })
})
