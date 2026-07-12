import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignupPage from './page'

const { createUserWithEmailAndPasswordMock } = vi.hoisted(() => ({
  createUserWithEmailAndPasswordMock: vi.fn(),
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
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
}))

vi.mock('../../components/GoogleSignInButton', () => ({
  default: () => <div data-testid="google-signin-button" />,
}))

describe('SignupPage', () => {
  it('renders the Google sign-in button', () => {
    render(<SignupPage />)

    expect(screen.getByTestId('google-signin-button')).toBeInTheDocument()
  })

  it('shows a friendly error when the email is already in use', async () => {
    createUserWithEmailAndPasswordMock.mockRejectedValueOnce(
      Object.assign(new Error('in use'), { code: 'auth/email-already-in-use' }),
    )
    render(<SignupPage />)

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    await waitFor(() => {
      expect(screen.getByText('Esse email já tem uma conta. Tente entrar.')).toBeInTheDocument()
    })
  })
})
