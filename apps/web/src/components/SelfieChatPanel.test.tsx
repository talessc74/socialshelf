import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssistantProvider } from '../contexts/AssistantContext'
import { SelfieChatPanel } from './SelfieChatPanel'

vi.mock('../lib/api', () => ({
  api: { askSelfie: vi.fn() },
}))

function renderPanel() {
  return render(
    <AssistantProvider>
      <SelfieChatPanel />
    </AssistantProvider>,
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  const { api } = await import('../lib/api')
  vi.mocked(api.askSelfie).mockReset()
})

describe('SelfieChatPanel', () => {
  it('mostra uma mensagem de boas-vindas quando não há histórico', () => {
    renderPanel()
    expect(screen.getByText(/pode me perguntar qualquer coisa/i)).toBeInTheDocument()
  })

  it('envia a pergunta, mostra "Pensando…" e depois a resposta', async () => {
    const { api } = await import('../lib/api')
    let resolveAnswer: (value: string) => void = () => {}
    vi.mocked(api.askSelfie).mockReturnValue(new Promise((resolve) => (resolveAnswer = resolve)))

    renderPanel()
    await userEvent.type(screen.getByPlaceholderText('Digite sua pergunta…'), 'Como conecto o TikTok?')
    await userEvent.click(screen.getByText('Enviar'))

    expect(screen.getByText('Como conecto o TikTok?')).toBeInTheDocument()
    expect(screen.getByText('Pensando…')).toBeInTheDocument()

    resolveAnswer('Clique em Conectar no card do TikTok.')

    await waitFor(() => {
      expect(screen.getByText('Clique em Conectar no card do TikTok.')).toBeInTheDocument()
    })
    expect(screen.queryByText('Pensando…')).not.toBeInTheDocument()
  })

  it('envia o histórico da conversa anterior na segunda pergunta', async () => {
    const { api } = await import('../lib/api')
    vi.mocked(api.askSelfie)
      .mockResolvedValueOnce('Primeira resposta.')
      .mockResolvedValueOnce('Segunda resposta.')

    renderPanel()
    await userEvent.type(screen.getByPlaceholderText('Digite sua pergunta…'), 'Primeira pergunta')
    await userEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(screen.getByText('Primeira resposta.')).toBeInTheDocument())

    await userEvent.type(screen.getByPlaceholderText('Digite sua pergunta…'), 'Segunda pergunta')
    await userEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(screen.getByText('Segunda resposta.')).toBeInTheDocument())

    expect(api.askSelfie).toHaveBeenNthCalledWith(2, 'Segunda pergunta', [
      { role: 'user', text: 'Primeira pergunta' },
      { role: 'selfie', text: 'Primeira resposta.' },
    ])
  })

  it('mostra uma mensagem de erro quando a pergunta falha', async () => {
    const { api } = await import('../lib/api')
    vi.mocked(api.askSelfie).mockRejectedValue(new Error('Falha de rede'))

    renderPanel()
    await userEvent.type(screen.getByPlaceholderText('Digite sua pergunta…'), 'Como conecto o X?')
    await userEvent.click(screen.getByText('Enviar'))

    await waitFor(() => {
      expect(screen.getByText('Falha de rede')).toBeInTheDocument()
    })
  })

  it('desabilita o botão de enviar quando o campo está vazio', () => {
    renderPanel()
    expect(screen.getByText('Enviar')).toBeDisabled()
  })
})
