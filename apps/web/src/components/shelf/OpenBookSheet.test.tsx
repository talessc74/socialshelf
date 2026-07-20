import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OpenBookSheet } from './OpenBookSheet'
import { SHELF_SECTIONS } from '../../lib/shelfSections'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const noticias = SHELF_SECTIONS.find((s) => s.id === 'noticias')!
const onClose = vi.fn()

beforeEach(() => {
  push.mockClear()
  onClose.mockClear()
})

describe('OpenBookSheet', () => {
  it('mostra a identidade da seção (título e masthead do tema)', () => {
    render(<OpenBookSheet section={noticias} onClose={onClose} />)
    expect(screen.getByText('Notícias')).toBeInTheDocument()
    expect(screen.getByText('THE SHELF GAZETTE')).toBeInTheDocument()
  })

  it('o CTA leva à rota real da seção', () => {
    render(<OpenBookSheet section={noticias} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Abrir as Notícias/ }))
    expect(push).toHaveBeenCalledWith('/dashboard/news')
  })

  it('"Voltar à estante" fecha a folha', () => {
    render(<OpenBookSheet section={noticias} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '← Voltar à estante' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('sem masthead no tema, não renderiza um', () => {
    const marca = SHELF_SECTIONS.find((s) => s.id === 'marca')!
    render(<OpenBookSheet section={marca} onClose={onClose} />)
    expect(screen.getByText('Marca')).toBeInTheDocument()
    expect(screen.queryByText('THE SHELF GAZETTE')).not.toBeInTheDocument()
  })
})
