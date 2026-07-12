import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ForgotPasswordPage from './page'

const { sendPasswordResetEmailMock } = vi.hoisted(() => ({
  sendPasswordResetEmailMock: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}))

vi.mock('../../lib/firebase', () => ({
  auth: {},
}))

describe('ForgotPasswordPage', () => {
  it('sends a reset email and shows the generic confirmation message on success', async () => {
    sendPasswordResetEmailMock.mockResolvedValueOnce(undefined)
    render(<ForgotPasswordPage />)

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enviar link de recuperação/i }))

    await waitFor(() => {
      expect(screen.getByText(/enviamos um link para redefinir a senha/i)).toBeInTheDocument()
    })
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({}, 'user@example.com')
  })

  it('shows the same generic confirmation message even when the account does not exist', async () => {
    sendPasswordResetEmailMock.mockRejectedValueOnce(
      Object.assign(new Error('no user'), { code: 'auth/user-not-found' }),
    )
    render(<ForgotPasswordPage />)

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'nobody@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enviar link de recuperação/i }))

    await waitFor(() => {
      expect(screen.getByText(/enviamos um link para redefinir a senha/i)).toBeInTheDocument()
    })
  })
})
