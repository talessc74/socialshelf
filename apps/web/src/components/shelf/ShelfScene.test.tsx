import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShelfScene } from './ShelfScene'
import { ThemeProvider } from '../../contexts/ThemeContext'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

function renderScene() {
  return render(
    <ThemeProvider>
      <ShelfScene />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  push.mockClear()
  window.localStorage.clear()
})

describe('ShelfScene', () => {
  it('mostra os 7 livros', () => {
    renderScene()
    // Cada seção tem um botão "Abrir {nome}" — checagem inequívoca de que os 7 estão na cena.
    for (const name of ['Agenda', 'Notícias', 'Desempenho', 'Criar', 'Campanhas', 'Marca', 'Redes']) {
      expect(screen.getByLabelText(`Abrir ${name}`)).toBeInTheDocument()
    }
  })

  it('clicar num livro navega para a rota real', () => {
    renderScene()
    fireEvent.click(screen.getByLabelText('Abrir Agenda'))
    expect(push).toHaveBeenCalledWith('/dashboard/scheduled')
  })

  it('cada capa aponta para a sua rota', () => {
    renderScene()
    fireEvent.click(screen.getByLabelText('Abrir Redes'))
    expect(push).toHaveBeenCalledWith('/dashboard/accounts')
  })

  it('o interruptor de parede alterna claro/escuro', () => {
    renderScene()
    const wall = screen.getByLabelText('Interruptor de parede — alternar claro e escuro')
    const before = wall.getAttribute('aria-pressed')
    fireEvent.click(wall)
    expect(wall.getAttribute('aria-pressed')).not.toBe(before)
  })
})
