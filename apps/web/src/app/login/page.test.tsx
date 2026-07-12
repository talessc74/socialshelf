import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './page'

const { signInWithRedirectMock, getRedirectResultMock, signInWithEmailAndPasswordMock } = vi.hoisted(() => ({
  signInWithRedirectMock: vi.fn().mockResolvedValue(undefined),
  getRedirectResultMock: vi.fn().mockResolvedValue(null),
  signInWithEmailAndPasswordMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('../../lib/firebase', () => ({
  auth: {},
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signInWithRedirect: signInWithRedirectMock,
  getRedirectResult: getRedirectResultMock,
  GoogleAuthProvider: vi.fn(),
}))

describe('LoginPage', () => {
  it('calls getRedirectResult on mount to pick up a pending Google redirect', async () => {
    render(<LoginPage />)

    await waitFor(() => {
      expect(getRedirectResultMock).toHaveBeenCalledWith({})
    })
  })

  it('uses signInWithRedirect (not a popup) when "Entrar com Google" is clicked', async () => {
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: /entrar com google/i }))

    await waitFor(() => {
      expect(signInWithRedirectMock).toHaveBeenCalled()
    })
  })

  it('shows a generic error when the pending redirect result fails', async () => {
    getRedirectResultMock.mockRejectedValueOnce(new Error('unauthorized-domain'))
    render(<LoginPage />)

    await waitFor(() => {
      expect(screen.getByText('Não foi possível entrar com Google.')).toBeInTheDocument()
    })
  })
})
