import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { User } from 'firebase/auth'

const { mockOnAuthStateChanged } = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
  signOut: vi.fn(),
}))

vi.mock('../lib/firebase', () => ({ auth: {} }))

import { AuthProvider } from './AuthContext.js'

function makeUser(uid: string): User {
  return { uid, email: `${uid}@exemplo.com` } as User
}

function renderWithClient(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <div />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

function firedCallback(): (user: User | null) => void {
  return mockOnAuthStateChanged.mock.calls[0]![1] as (user: User | null) => void
}

beforeEach(() => {
  mockOnAuthStateChanged.mockReset().mockReturnValue(vi.fn())
})

describe('AuthProvider — limpeza do cache do React Query ao trocar de conta', () => {
  it('não limpa o cache no primeiro estado de autenticação recebido (carregamento inicial)', async () => {
    const client = new QueryClient()
    const clearSpy = vi.spyOn(client, 'clear')
    renderWithClient(client)

    firedCallback()(makeUser('user-a'))

    await waitFor(() => expect(mockOnAuthStateChanged).toHaveBeenCalled())
    expect(clearSpy).not.toHaveBeenCalled()
  })

  it('limpa o cache quando o uid muda de um usuário para outro (troca de conta Google)', async () => {
    const client = new QueryClient()
    const clearSpy = vi.spyOn(client, 'clear')
    renderWithClient(client)
    const callback = firedCallback()

    callback(makeUser('user-a'))
    callback(makeUser('user-b'))

    expect(clearSpy).toHaveBeenCalledTimes(1)
  })

  it('limpa o cache ao deslogar (uid vira null)', async () => {
    const client = new QueryClient()
    const clearSpy = vi.spyOn(client, 'clear')
    renderWithClient(client)
    const callback = firedCallback()

    callback(makeUser('user-a'))
    callback(null)

    expect(clearSpy).toHaveBeenCalledTimes(1)
  })

  it('não limpa o cache quando o mesmo usuário dispara de novo (ex.: refresh de token)', async () => {
    const client = new QueryClient()
    const clearSpy = vi.spyOn(client, 'clear')
    renderWithClient(client)
    const callback = firedCallback()

    callback(makeUser('user-a'))
    callback(makeUser('user-a'))
    callback(makeUser('user-a'))

    expect(clearSpy).not.toHaveBeenCalled()
  })
})
