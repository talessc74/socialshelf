import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
