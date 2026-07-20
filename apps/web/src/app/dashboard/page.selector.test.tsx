import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { User } from 'firebase/auth'
import DashboardPage from './page'
import { ViewModeProvider } from '../../contexts/ViewModeProvider'
import { useAuth } from '../../contexts/AuthContext'

// AuthContext é mockado por inteiro para não inicializar o Firebase (padrão do
// repo). ClassicHome e ShelfHome viram marcadores: aqui só interessa QUAL o
// seletor escolhe, não o conteúdo de cada um.
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('./ClassicHome', () => ({ ClassicHome: () => <div>HOME_CLASSICA</div> }))
vi.mock('./ShelfHome', () => ({ ShelfHome: () => <div>HOME_PRATELEIRA</div> }))

const mockedUseAuth = vi.mocked(useAuth)

function asUser(email: string, uid: string) {
  mockedUseAuth.mockReturnValue({ user: { email, uid } as User, loading: false, logout: vi.fn() })
}

function renderHome() {
  return render(
    <ViewModeProvider>
      <DashboardPage />
    </ViewModeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('DashboardPage - seletor de visual', () => {
  it('mostra a home clássica por padrão para o admin (novo visual desligado)', async () => {
    asUser('talessc@me.com', 'admin-1')

    renderHome()

    expect(await screen.findByText('HOME_CLASSICA')).toBeInTheDocument()
    expect(screen.queryByText('HOME_PRATELEIRA')).not.toBeInTheDocument()
  })

  it('mostra a prateleira para o admin que escolheu shelf', async () => {
    window.localStorage.setItem('socialshelf:viewMode:admin-1', 'shelf')
    asUser('talessc@me.com', 'admin-1')

    renderHome()

    await waitFor(() => expect(screen.getByText('HOME_PRATELEIRA')).toBeInTheDocument())
    expect(screen.queryByText('HOME_CLASSICA')).not.toBeInTheDocument()
  })

  it('nega a prateleira ao usuário comum, mesmo com shelf gravado', async () => {
    window.localStorage.setItem('socialshelf:viewMode:user-1', 'shelf')
    asUser('alguem@exemplo.com', 'user-1')

    renderHome()

    expect(await screen.findByText('HOME_CLASSICA')).toBeInTheDocument()
    expect(screen.queryByText('HOME_PRATELEIRA')).not.toBeInTheDocument()
  })
})
