import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopicChecklist } from './TopicChecklist'

describe('TopicChecklist', () => {
  it('starts with no option checked and the custom field collapsed', () => {
    render(
      <TopicChecklist label="Tópicos" options={['Opção A', 'Opção B']} values={[]} onChange={vi.fn()} />,
    )

    expect(screen.getByLabelText('Opção A')).not.toBeChecked()
    expect(screen.getByLabelText('Opção B')).not.toBeChecked()
    expect(screen.getByRole('textbox')).not.toBeVisible()
  })

  it('checks an option that is already present in values', () => {
    render(
      <TopicChecklist label="Tópicos" options={['Opção A', 'Opção B']} values={['Opção A']} onChange={vi.fn()} />,
    )

    expect(screen.getByLabelText('Opção A')).toBeChecked()
    expect(screen.getByLabelText('Opção B')).not.toBeChecked()
  })

  it('adds the option to values when checked, and removes it when unchecked', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <TopicChecklist label="Tópicos" options={['Opção A', 'Opção B']} values={[]} onChange={onChange} />,
    )

    fireEvent.click(screen.getByLabelText('Opção A'))
    expect(onChange).toHaveBeenCalledWith(['Opção A'])

    rerender(
      <TopicChecklist label="Tópicos" options={['Opção A', 'Opção B']} values={['Opção A']} onChange={onChange} />,
    )
    fireEvent.click(screen.getByLabelText('Opção A'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds a custom value typed in the collapsed field, without duplicating checkbox options', () => {
    const onChange = vi.fn()
    render(
      <TopicChecklist
        label="Tópicos"
        options={['Opção A']}
        values={[]}
        onChange={onChange}
        customPlaceholder="Digite um tópico"
      />,
    )

    fireEvent.click(screen.getByText(/tópico personalizado/i))
    fireEvent.change(screen.getByPlaceholderText('Digite um tópico'), { target: { value: 'Tópico livre' } })
    fireEvent.click(screen.getByText('Adicionar'))

    expect(onChange).toHaveBeenCalledWith(['Tópico livre'])
  })

  it('only shows custom-added values as removable chips, not the checkbox options', () => {
    render(
      <TopicChecklist
        label="Tópicos"
        options={['Opção A']}
        values={['Opção A', 'Tópico livre']}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Tópico livre')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Opção A' })).not.toBeInTheDocument()
  })
})
