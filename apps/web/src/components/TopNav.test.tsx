import type { ComponentProps } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { TopNav } from './TopNav'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AssistantProvider } from '../contexts/AssistantContext'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

// AssistantContext passou a importar lib/api (askSelfie, _local-adr-policy-045) — sem mock,
// isso puxa a cadeia real do Firebase Auth (lib/api.ts -> lib/firebase.ts -> getAuth(app)),
// que lança "auth/invalid-api-key" fora de um app Firebase de verdade.
vi.mock('../lib/api', () => ({
  api: { askSelfie: vi.fn() },
}))

function mockNavOverflow(nav: HTMLElement, { scrollLeft, clientWidth, scrollWidth }: { scrollLeft: number; clientWidth: number; scrollWidth: number }) {
  Object.defineProperty(nav, 'clientWidth', { configurable: true, value: clientWidth })
  Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: scrollWidth })
  Object.defineProperty(nav, 'scrollLeft', { configurable: true, value: scrollLeft, writable: true })
}

function getMobileNav(container: HTMLElement) {
  return container.querySelector('[data-testid="mobile-nav"]') as HTMLElement
}

function getDesktopNav(container: HTMLElement) {
  return container.querySelector('[data-testid="desktop-nav"]') as HTMLElement
}

function renderTopNav(props: Partial<ComponentProps<typeof TopNav>> = {}) {
  return render(
    <ThemeProvider>
      <AssistantProvider>
        <TopNav email="user@example.com" onLogout={vi.fn()} {...props} />
      </AssistantProvider>
    </ThemeProvider>
  )
}

describe('TopNav - nav mobile (segunda linha)', () => {
  it('não mostra nenhum gradiente quando todos os itens cabem na tela', () => {
    const { container } = renderTopNav()
    const nav = getMobileNav(container)
    mockNavOverflow(nav, { scrollLeft: 0, clientWidth: 800, scrollWidth: 800 })
    fireEvent.scroll(nav)

    expect(container.querySelector('.bg-gradient-to-l')).not.toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-r')).not.toBeInTheDocument()
  })

  it('mostra gradiente à direita quando há itens escondidos à direita', () => {
    const { container } = renderTopNav()
    const nav = getMobileNav(container)
    mockNavOverflow(nav, { scrollLeft: 0, clientWidth: 390, scrollWidth: 832 })
    fireEvent.scroll(nav)

    expect(container.querySelector('.bg-gradient-to-l')).toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-r')).not.toBeInTheDocument()
  })

  it('mostra gradiente à esquerda após rolar e some o da direita ao chegar no fim', () => {
    const { container } = renderTopNav()
    const nav = getMobileNav(container)
    mockNavOverflow(nav, { scrollLeft: 442, clientWidth: 390, scrollWidth: 832 })
    fireEvent.scroll(nav)

    expect(container.querySelector('.bg-gradient-to-r')).toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-l')).not.toBeInTheDocument()
  })
})

describe('TopNav - nav desktop (barra principal)', () => {
  // Bug real: com itens suficientes (13, contando "Manual"), a barra de desktop
  // (overflow-x-auto) podia cortar itens à direita sem nenhum indício visual de que dava pra
  // rolar — os gradientes de affordance só eram calculados a partir do nav mobile. Corrigido:
  // updateScrollAffordance passa a ler o nav que estiver de fato visível (clientWidth > 0).
  it('mostra gradiente à direita quando a barra de desktop tem itens escondidos', () => {
    const { container } = renderTopNav()
    const desktopNav = getDesktopNav(container)
    mockNavOverflow(desktopNav, { scrollLeft: 0, clientWidth: 600, scrollWidth: 900 })
    fireEvent.scroll(desktopNav)

    expect(container.querySelector('.bg-gradient-to-l')).toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-r')).not.toBeInTheDocument()
  })

  it('não mostra gradiente na barra de desktop quando todos os itens cabem', () => {
    const { container } = renderTopNav()
    const desktopNav = getDesktopNav(container)
    mockNavOverflow(desktopNav, { scrollLeft: 0, clientWidth: 900, scrollWidth: 900 })
    fireEvent.scroll(desktopNav)

    expect(container.querySelector('.bg-gradient-to-l')).not.toBeInTheDocument()
    expect(container.querySelector('.bg-gradient-to-r')).not.toBeInTheDocument()
  })
})

describe('TopNav - link de admin', () => {
  it('não mostra "Gastos de IA (todas as contas)" para quem não é admin', () => {
    renderTopNav()

    expect(screen.queryByText('Gastos de IA (todas as contas)')).not.toBeInTheDocument()
  })

  it('mostra "Gastos de IA (todas as contas)" só para quem é admin', () => {
    renderTopNav({ isAdmin: true })

    expect(screen.getAllByText('Gastos de IA (todas as contas)').length).toBeGreaterThan(0)
  })
})

describe('TopNav - link do próprio gasto de IA', () => {
  it('mostra "Meus Gastos de IA" para qualquer usuário autenticado, admin ou não', () => {
    renderTopNav()

    expect(screen.getAllByText('Meus Gastos de IA').length).toBeGreaterThan(0)
  })
})

describe('TopNav - ícone de religar o Selfie', () => {
  const DISMISSED_KEY = 'socialshelf:selfie:dismissed'

  it('mostra "Trazer o Selfie de volta" quando o Selfie já foi dispensado antes', async () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    renderTopNav()

    expect(await screen.findByTitle('Trazer o Selfie de volta')).toBeInTheDocument()
  })

  it('mostra "Desligar o Selfie" quando o Selfie está ativo', async () => {
    window.localStorage.removeItem(DISMISSED_KEY)
    renderTopNav()

    expect(await screen.findByTitle('Desligar o Selfie')).toBeInTheDocument()
  })

  it('clicar no ícone depois de dispensado limpa a preferência salva', async () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    renderTopNav()

    const button = await screen.findByTitle('Trazer o Selfie de volta')
    fireEvent.click(button)

    expect(window.localStorage.getItem(DISMISSED_KEY)).toBeNull()
    expect(await screen.findByTitle('Desligar o Selfie')).toBeInTheDocument()
  })
})
