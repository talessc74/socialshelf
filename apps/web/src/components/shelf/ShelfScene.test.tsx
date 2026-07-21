import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShelfScene } from './ShelfScene'
import { ThemeProvider } from '../../contexts/ThemeContext'

const onOpen = vi.fn()

function renderScene() {
  return render(
    <ThemeProvider>
      <ShelfScene onOpen={onOpen} />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  onOpen.mockClear()
  window.localStorage.clear()
})

describe('ShelfScene', () => {
  it('mostra os 7 livros', () => {
    renderScene()
    for (const name of ['Agenda', 'Notícias', 'Desempenho', 'Criar', 'Campanhas', 'Marca', 'Redes']) {
      expect(screen.getByLabelText(`Abrir ${name}`)).toBeInTheDocument()
    }
  })

  it('clicar num livro chama onOpen com a seção certa', () => {
    renderScene()
    fireEvent.click(screen.getByLabelText('Abrir Agenda'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'agenda', route: '/dashboard/scheduled' }))
  })

  it('cada capa abre a sua seção', () => {
    renderScene()
    fireEvent.click(screen.getByLabelText('Abrir Redes'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'redes', route: '/dashboard/accounts' }))
  })

  it('o interruptor de parede alterna claro/escuro', () => {
    renderScene()
    const wall = screen.getByLabelText('Interruptor de parede — alternar claro e escuro')
    const before = wall.getAttribute('aria-pressed')
    fireEvent.click(wall)
    expect(wall.getAttribute('aria-pressed')).not.toBe(before)
  })
})
