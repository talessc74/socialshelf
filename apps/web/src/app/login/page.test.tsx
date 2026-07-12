import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from './page'

const { signInWithEmailAndPasswordMock } = vi.hoisted(() => ({
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
}))

vi.mock('../../components/GoogleSignInButton', () => ({
  default: () => <div data-testid="google-signin-button" />,
}))

describe('LoginPage', () => {
  it('renders the Google sign-in button', () => {
    render(<LoginPage />)

    expect(screen.getByTestId('google-signin-button')).toBeInTheDocument()
  })

  it('shows a generic error when email/password login fails', async () => {
    signInWithEmailAndPasswordMock.mockRejectedValueOnce(new Error('invalid'))
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(screen.getByText('Email ou senha inválidos.')).toBeInTheDocument()
    })
  })
})
