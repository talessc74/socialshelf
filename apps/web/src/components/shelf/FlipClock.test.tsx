import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlipClock } from './FlipClock'

const onOpen = vi.fn()

beforeEach(() => {
  onOpen.mockClear()
})

describe('FlipClock', () => {
  it('começa na primeira seção (Agenda)', () => {
    render(<FlipClock onOpen={onOpen} />)
    expect(screen.getByRole('button', { name: 'Abrir Agenda →' })).toBeInTheDocument()
  })

  it('tocar em "Abrir" chama onOpen com a seção atual', () => {
    render(<FlipClock onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Agenda →' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'agenda', route: '/dashboard/scheduled' }))
  })

  it('tocar no visor esquerdo abre a seção atual', () => {
    render(<FlipClock onOpen={onOpen} />)
    fireEvent.click(screen.getByLabelText('Abrir Agenda'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'agenda' }))
  })

  it('a crown avança para a próxima seção', async () => {
    render(<FlipClock onOpen={onOpen} />)
    fireEvent.click(screen.getByLabelText('Girar para a próxima seção'))
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Abrir Notícias →' })).toBeInTheDocument(),
      { timeout: 1500 },
    )
  })

  it('os dots pulam direto para uma seção', async () => {
    render(<FlipClock onOpen={onOpen} />)
    fireEvent.click(screen.getByLabelText('Ir para Marca'))
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Abrir Marca →' })).toBeInTheDocument(),
      { timeout: 1500 },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Marca →' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'marca', route: '/dashboard/brand' }))
  })
})
