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

    expect(screen.getAllByRole('link', { name: /Criar (minha conta|conta no SocialShelf)/ })[0]).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.getByRole('link', { name: 'contato@socialshelf.com.br' })).toHaveAttribute(
      'href',
      'mailto:contato@socialshelf.com.br',
    )
  })

  it('explica o pré-requisito de conta profissional do Instagram, com link pro artigo oficial', () => {
    render(<ComeceAquiPage />)

    expect(screen.getByText(/a conta precisa ser profissional/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /artigo oficial do Instagram/ })).toHaveAttribute(
      'href',
      'https://help.instagram.com/502981923235522',
    )
  })

  it('linka pro Instagram, Facebook e documentação oficial da Meta sobre papéis de app', () => {
    render(<ComeceAquiPage />)

    expect(screen.getByRole('link', { name: 'app do Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/')
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/')
    expect(screen.getByRole('link', { name: /documentação oficial da Meta sobre papéis de app/ })).toHaveAttribute(
      'href',
      'https://developers.facebook.com/docs/development/build-and-test/app-roles',
    )
  })
})
