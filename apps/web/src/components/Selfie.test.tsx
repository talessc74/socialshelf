import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssistantProvider, useSelfieNarration } from '../contexts/AssistantContext'
import { Selfie } from './Selfie'

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

function renderSelfie() {
  return render(
    <AssistantProvider>
      <NarrationDriver />
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

beforeEach(() => {
  window.localStorage.clear()
  mockReducedMotion(false)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Selfie', () => {
  it('não renderiza nada quando não há narração ativa', () => {
    renderSelfie()
    expect(screen.queryByTestId('selfie')).not.toBeInTheDocument()
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

  it('some quando a narração é limpa', async () => {
    renderSelfie()
    await userEvent.click(screen.getByText('narrar'))
    expect(screen.getByTestId('selfie')).toBeInTheDocument()
    await userEvent.click(screen.getByText('limpar'))
    expect(screen.queryByTestId('selfie')).not.toBeInTheDocument()
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
