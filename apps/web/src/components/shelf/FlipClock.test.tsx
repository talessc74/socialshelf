import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlipClock } from './FlipClock'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  push.mockClear()
})

describe('FlipClock', () => {
  it('começa na primeira seção (Agenda)', () => {
    render(<FlipClock />)
    expect(screen.getByRole('button', { name: 'Abrir Agenda →' })).toBeInTheDocument()
  })

  it('tocar em "Abrir" navega para a rota da seção atual', () => {
    render(<FlipClock />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Agenda →' }))
    expect(push).toHaveBeenCalledWith('/dashboard/scheduled')
  })

  it('tocar no visor esquerdo abre a seção atual', () => {
    render(<FlipClock />)
    fireEvent.click(screen.getByLabelText('Abrir Agenda'))
    expect(push).toHaveBeenCalledWith('/dashboard/scheduled')
  })

  it('a crown avança para a próxima seção', async () => {
    render(<FlipClock />)
    fireEvent.click(screen.getByLabelText('Girar para a próxima seção'))
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Abrir Notícias →' })).toBeInTheDocument(),
      { timeout: 1500 },
    )
  })

  it('os dots pulam direto para uma seção', async () => {
    render(<FlipClock />)
    fireEvent.click(screen.getByLabelText('Ir para Marca'))
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Abrir Marca →' })).toBeInTheDocument(),
      { timeout: 1500 },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Marca →' }))
    expect(push).toHaveBeenCalledWith('/dashboard/brand')
  })
})
