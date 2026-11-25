import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ManualPage from './page'

const backMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock }),
}))

describe('ManualPage', () => {
  it('mostra o título e as seções principais', () => {
    render(<ManualPage />)

    expect(screen.getByText('Manual do SocialShelf')).toBeInTheDocument()
    expect(screen.getByText('O que é o SocialShelf')).toBeInTheDocument()
    expect(screen.getByText('Menu principal')).toBeInTheDocument()
    expect(screen.getByText('Como conectar cada rede social')).toBeInTheDocument()
    expect(screen.getByText('Problemas comuns de conexão')).toBeInTheDocument()
    expect(screen.getByText('Créditos de IA')).toBeInTheDocument()
  })

  it('lista os itens do menu principal como links de navegação real', () => {
    render(<ManualPage />)

    const contasLink = screen.getByRole('link', { name: 'Contas' })
    expect(contasLink).toHaveAttribute('href', '/dashboard/accounts')

    const assinaturaLink = screen.getByRole('link', { name: 'Assinatura' })
    expect(assinaturaLink).toHaveAttribute('href', '/dashboard/billing')
  })

  it('explica os problemas comuns de conexão com a solução ao lado', () => {
    render(<ManualPage />)

    expect(screen.getByText('"Nenhuma Página do Facebook encontrada"')).toBeInTheDocument()
    expect(
      screen.getByText('A conta logou certo, mas não administra nenhuma Página do Facebook. Crie uma Página (grátis) antes de conectar.'),
    ).toBeInTheDocument()
  })

  it('linka pra Meus Gastos de IA no menu e pra comprar créditos na seção de créditos', () => {
    render(<ManualPage />)

    expect(screen.getByRole('link', { name: 'Meus Gastos de IA' })).toHaveAttribute('href', '/dashboard/ai-usage')
    expect(screen.getByRole('link', { name: 'Comprar créditos' })).toHaveAttribute('href', '/dashboard/billing/credits')
  })

  it('volta pra tela anterior ao clicar em "Voltar"', () => {
    render(<ManualPage />)

    screen.getByText('← Voltar').click()

    expect(backMock).toHaveBeenCalled()
  })
})
