import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ComeceAquiPage from './page'

describe('ComeceAquiPage', () => {
  it('explica o que funciona na hora e o que depende de liberação manual', () => {
    render(<ComeceAquiPage />)

    expect(screen.getByText('Como entrar no SocialShelf')).toBeInTheDocument()
    expect(screen.getByText('Conectar LinkedIn, X (antigo Twitter) ou TikTok.')).toBeInTheDocument()
    expect(screen.getByText(/App Review/)).toBeInTheDocument()
  })

  it('explica o passo de aceitar o convite de testador no Instagram', () => {
    render(<ComeceAquiPage />)

    expect(screen.getByText(/Convites de testador/)).toBeInTheDocument()
  })

  it('linka para criar conta e para o e-mail de contato', () => {
    render(<ComeceAquiPage />)

    expect(screen.getByRole('link', { name: 'Criar minha conta' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'contato@socialshelf.com.br' })).toHaveAttribute(
      'href',
      'mailto:contato@socialshelf.com.br',
    )
  })
})
