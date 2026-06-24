import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TopNav } from './TopNav'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

function mockNavOverflow(nav: HTMLElement, { scrollLeft, clientWidth, scrollWidth }: { scrollLeft: number; clientWidth: number; scrollWidth: number }) {
  Object.defineProperty(nav, 'clientWidth', { configurable: true, value: clientWidth })
  Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(nav, 'scrollLeft', { configurable: true, value: scrollLeft, writable: true })
}

function getMobileNav(container: HTMLElement) {
  return container.querySelector('nav.overflow-x-auto') as HTMLElement
}

describe('TopNav - nav mobile (segunda linha)', () => {
  it('não mostra nenhum gradiente quando todos os itens cabem na tela', () => {
    const { container } = render(<TopNav email="user@example.com" onLogout={vi.fn()} />)
    const nav = getMobileNav(container)
    mockNavOverflow(nav, { scrollLeft: 0, clientWidth: 800, scrollWidth: 800 })
    fireEvent.scroll(nav)

    expect(container.querySelector('.bg-gradient-to-l')).not.toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-r')).not.toBeInTheDocument()
  })

  it('mostra gradiente à direita quando há itens escondidos à direita', () => {
    const { container } = render(<TopNav email="user@example.com" onLogout={vi.fn()} />)
    const nav = getMobileNav(container)
    mockNavOverflow(nav, { scrollLeft: 0, clientWidth: 390, scrollWidth: 832 })
    fireEvent.scroll(nav)

    expect(container.querySelector('.bg-gradient-to-l')).toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-r')).not.toBeInTheDocument()
  })

  it('mostra gradiente à esquerda após rolar e some o da direita ao chegar no fim', () => {
    const { container } = render(<TopNav email="user@example.com" onLogout={vi.fn()} />)
    const nav = getMobileNav(container)
    mockNavOverflow(nav, { scrollLeft: 442, clientWidth: 390, scrollWidth: 832 })
    fireEvent.scroll(nav)

    expect(container.querySelector('.bg-gradient-to-r')).toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-l')).not.toBeInTheDocument()
  })
})
