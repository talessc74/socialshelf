import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreditConfirmModal } from './CreditConfirmModal'

describe('CreditConfirmModal', () => {
  it('mostra quantos créditos a ação pode consumir, no plural', () => {
    render(<CreditConfirmModal creditsNeeded={5} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/5/)).toBeInTheDocument()
    expect(screen.getByText(/créditos de IA/)).toBeInTheDocument()
  })

  it('usa o singular quando é só 1 crédito', () => {
    render(<CreditConfirmModal creditsNeeded={1} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/crédito de IA/)).toBeInTheDocument()
  })

  it('chama onConfirm ao clicar em Gerar', () => {
    const onConfirm = vi.fn()
    render(<CreditConfirmModal creditsNeeded={3} onConfirm={onConfirm} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Gerar'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('chama onCancel ao clicar em Cancelar', () => {
    const onCancel = vi.fn()
    render(<CreditConfirmModal creditsNeeded={3} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('chama onCancel ao clicar fora do modal', () => {
    const onCancel = vi.fn()
    render(<CreditConfirmModal creditsNeeded={3} onConfirm={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('presentation'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('desabilita os botões e mostra "Gerando…" quando busy', () => {
    render(<CreditConfirmModal creditsNeeded={3} onConfirm={vi.fn()} onCancel={vi.fn()} busy />)
    expect(screen.getByText('Gerando…')).toBeDisabled()
    expect(screen.getByText('Cancelar')).toBeDisabled()
  })
})
