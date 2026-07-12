import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  beforeEach(() => {
    sessionStorage.clear()
  })

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
    expect(sessionStorage.getItem('googleSignInAttempted')).toBe('1')
  })

  it('shows the real Firebase error code when the pending redirect result fails', async () => {
    getRedirectResultMock.mockRejectedValueOnce(
      Object.assign(new Error('The domain is not authorized'), { code: 'auth/unauthorized-domain' }),
    )
    render(<LoginPage />)

    await waitFor(() => {
      expect(
        screen.getByText('Debug: falha no login Google — auth/unauthorized-domain — The domain is not authorized'),
      ).toBeInTheDocument()
    })
  })

  it('shows a debug message when returning from an attempted Google redirect with no result', async () => {
    sessionStorage.setItem('googleSignInAttempted', '1')
    getRedirectResultMock.mockResolvedValueOnce(null)
    render(<LoginPage />)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Debug: voltou do Google sem erro, mas getRedirectResult() não retornou um usuário (result=null).',
        ),
      ).toBeInTheDocument()
    })
  })

  it('shows no error on a normal page load with no pending redirect attempt', async () => {
    getRedirectResultMock.mockResolvedValueOnce(null)
    render(<LoginPage />)

    await waitFor(() => {
      expect(getRedirectResultMock).toHaveBeenCalled()
    })
    expect(screen.queryByText(/Debug:/)).not.toBeInTheDocument()
  })
})
