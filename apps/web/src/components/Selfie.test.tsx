import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssistantProvider, useSelfieDismissal, useSelfieNarration } from '../contexts/AssistantContext'
import { Selfie } from './Selfie'

vi.mock('../lib/api', () => ({
  api: { askSelfie: vi.fn().mockResolvedValue('Vá em Central de Contas e clique em Reconectar.') },
}))

const DISMISSED_KEY = 'socialshelf:selfie:dismissed'

/** Botão auxiliar que publica/limpa narração, para dirigir o estado nos testes. */
function NarrationDriver() {
  const { narrate, clearNarration } = useSelfieNarration()
  return (
    <>
      <button onClick={() => narrate('Escrevendo a copy…')}>narrar</button>
      <button onClick={() => clearNarration()}>limpar</button>
    </>
  )
}

/** Simula o ícone de religar do TopNav, sem precisar montar o TopNav inteiro. */
function DismissalDriver() {
  const { setSelfieDismissed } = useSelfieDismissal()
  return <button onClick={() => setSelfieDismissed(false)}>religar</button>
}

function renderSelfie() {
  return render(
    <AssistantProvider>
      <NarrationDriver />
      <DismissalDriver />
      <Selfie />
    </AssistantProvider>,
  )
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches: reduce && query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

beforeEach(async () => {
  window.localStorage.clear()
  mockReducedMotion(false)
  // `afterEach` abaixo chama vi.restoreAllMocks(), que também limpa a implementação deste
  // mock global (não só spies criados no teste) — precisa ser restaurado a cada teste.
  const { api } = await import('../lib/api')
  vi.mocked(api.askSelfie).mockResolvedValue('Vá em Central de Contas e clique em Reconectar.')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Selfie', () => {
  it('mostra o mascote mesmo sem narração ativa, mas sem nenhum balão de fala', () => {
    renderSelfie()
    expect(screen.getByTestId('selfie')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renderiza o balão com a mensagem quando o contexto narra', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.getByTestId('selfie')).toBeInTheDocument()
    expect(screen.getByText('Escrevendo a copy…')).toBeInTheDocument()
  })

  it('usa a arte oficial (/selfie.png) como mascote por padrão', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    const img = screen.getByTestId('selfie').querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', '/selfie.png')
    // fallback SVG só entra se a imagem falhar
    expect(screen.getByTestId('selfie').querySelector('svg')).toBeNull()
  })

  it('cai no mascote SVG se a arte oficial não carregar', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    const img = screen.getByTestId('selfie').querySelector('img')!
    fireEvent.error(img)
    expect(screen.getByTestId('selfie').querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('selfie').querySelector('img')).toBeNull()
  })

  it('o balão some quando a narração é limpa, mas o mascote continua visível', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.getByText('Escrevendo a copy…')).toBeInTheDocument()
    await userEvent.click(screen.getByText('limpar'))
    expect(screen.queryByText('Escrevendo a copy…')).not.toBeInTheDocument()
    expect(screen.getByTestId('selfie')).toBeInTheDocument()
  })

  it('dispensar oculta o Selfie e persiste a preferência', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    await userEvent.click(screen.getByLabelText('Não mostrar mais o Selfie'))
    expect(screen.queryByTestId('selfie')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1')
  })

  it('não reaparece se já foi dispensado antes (localStorage)', async () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.queryByTestId('selfie')).not.toBeInTheDocument()
  })

  it('religar depois de dispensado limpa a preferência e volta a mostrar o Selfie', async () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.queryByTestId('selfie')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('religar'))

    expect(screen.getByTestId('selfie')).toBeInTheDocument()
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBeNull()
  })

  it('sob prefers-reduced-motion não aplica a classe de animação, mas mantém o texto', async () => {
    mockReducedMotion(true)
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.getByText('Escrevendo a copy…')).toBeInTheDocument()
    expect(document.querySelector('.ss-selfie-float')).toBeNull()
  })

  it('renderiza pálpebra e rastro de partículas quando animado', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.getByTestId('selfie-eyelid')).toBeInTheDocument()
    expect(document.querySelectorAll('.ss-selfie-sparkle')).toHaveLength(4)
  })

  it('não renderiza pálpebra nem partículas sob prefers-reduced-motion', async () => {
    mockReducedMotion(true)
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.queryByTestId('selfie-eyelid')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.ss-selfie-sparkle')).toHaveLength(0)
  })

  it('pisca dentro da janela esperada e volta a abrir o olho', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // delay=3500ms; <0.28 falso => piscada única
    renderSelfie()
    fireEvent.click(screen.getByText('narrar'))

    const eyelid = () => screen.getByTestId('selfie-eyelid')
    expect(eyelid()).toHaveStyle({ transform: 'scaleY(0)' })

    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(eyelid()).toHaveStyle({ transform: 'scaleY(1)' })

    act(() => {
      vi.advanceTimersByTime(130)
    })
    expect(eyelid()).toHaveStyle({ transform: 'scaleY(0)' })
  })

  it('clicar no mascote abre o chat, substituindo o balão de narração', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.getByText('Escrevendo a copy…')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Perguntar algo ao Selfie'))

    expect(screen.getByTestId('selfie-chat-panel')).toBeInTheDocument()
    expect(screen.queryByText('Escrevendo a copy…')).not.toBeInTheDocument()
  })

  it('envia uma pergunta no chat e mostra a resposta da IA', async () => {
    const { api } = await import('../lib/api')
    renderSelfie()
    await userEvent.click(screen.getByLabelText('Perguntar algo ao Selfie'))

    await userEvent.type(screen.getByPlaceholderText('Digite sua pergunta…'), 'Como conecto o Instagram?')
    await userEvent.click(screen.getByText('Enviar'))

    expect(screen.getByText('Como conecto o Instagram?')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Vá em Central de Contas e clique em Reconectar.')).toBeInTheDocument()
    })
    expect(api.askSelfie).toHaveBeenCalledWith('Como conecto o Instagram?', [])
  })

  it('fechar o chat volta a mostrar o mascote flutuante', async () => {
    renderSelfie()
    await userEvent.click(screen.getByLabelText('Perguntar algo ao Selfie'))
    expect(screen.getByTestId('selfie-chat-panel')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Fechar chat'))

    expect(screen.queryByTestId('selfie-chat-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('selfie')).toBeInTheDocument()
  })

  it('não deixa timer de piscada vazar após desmontar', () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderSelfie()
    fireEvent.click(screen.getByText('narrar'))

    unmount()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(errorSpy).not.toHaveBeenCalled()
  })
})
