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
    expect(screen.getByText('Antes de começar')).toBeInTheDocument()
    expect(screen.getByText('Menu principal')).toBeInTheDocument()
    expect(screen.getByText('Como conectar cada rede social')).toBeInTheDocument()
    expect(screen.getByText('Confirmando que a conexão funcionou')).toBeInTheDocument()
    expect(screen.getByText('Criando seu primeiro post')).toBeInTheDocument()
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

  it('explica os dois sinais de conexão bem-sucedida', () => {
    render(<ManualPage />)

    expect(screen.getByText('Uma faixa verde no topo da tela com a mensagem "Conectado com sucesso".')).toBeInTheDocument()
    expect(
      screen.getByText('O card da rede social passa a mostrar "● Conectado", com o nome da conta ou Página logo abaixo.'),
    ).toBeInTheDocument()
  })

  it('mostra o passo a passo de criar o primeiro post', () => {
    render(<ManualPage />)

    expect(screen.getByText('Revise o texto e a imagem gerados — edite à vontade antes de publicar.')).toBeInTheDocument()
    expect(screen.getByText(/Escolha publicar agora ou agendar/)).toBeInTheDocument()
  })

  it('inclui o erro genérico de falha ao conectar entre os problemas comuns', () => {
    render(<ManualPage />)

    expect(screen.getByText('"Falha ao conectar plataforma. Tente novamente"')).toBeInTheDocument()
  })

  it('linka pra Meus Gastos de IA no menu e pra comprar créditos na seção de créditos', () => {
    render(<ManualPage />)

    expect(screen.getByRole('link', { name: 'Meus Gastos de IA' })).toHaveAttribute('href', '/dashboard/ai-usage')
    expect(screen.getByRole('link', { name: 'Comprar créditos' })).toHaveAttribute('href', '/dashboard/billing/credits')
  })

  it('linka o download do Guia Visual em PDF', () => {
    render(<ManualPage />)

    const downloadLink = screen.getByRole('link', { name: /Baixar Guia Visual \(PDF\)/ })
    expect(downloadLink).toHaveAttribute('href', '/guia-visual-socialshelf.pdf')
    expect(downloadLink).toHaveAttribute('download')
  })

  it('volta pra tela anterior ao clicar em "Voltar"', () => {
    render(<ManualPage />)

    screen.getByText('← Voltar').click()

    expect(backMock).toHaveBeenCalled()
  })
})
