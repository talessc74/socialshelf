import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import GoogleSignInButton from './GoogleSignInButton'

const { signInWithCredentialMock, credentialMock } = vi.hoisted(() => ({
  signInWithCredentialMock: vi.fn(),
  credentialMock: vi.fn((idToken: string) => ({ idToken })),
}))

vi.mock('../lib/firebase', () => ({
  auth: {},
}))

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: { credential: credentialMock },
  signInWithCredential: signInWithCredentialMock,
}))

vi.mock('next/script', () => ({
  default: ({ onLoad }: { onLoad: () => void }) => {
    setTimeout(onLoad, 0)
    return null
  },
}))

describe('GoogleSignInButton', () => {
  const initializeMock = vi.fn()
  const renderButtonMock = vi.fn()

  beforeEach(() => {
    initializeMock.mockClear()
    renderButtonMock.mockClear()
    signInWithCredentialMock.mockReset()
    ;(window as unknown as { google: unknown }).google = {
      accounts: { id: { initialize: initializeMock, renderButton: renderButtonMock } },
    }
  })

  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google
  })

  it('initializes Google Identity Services and renders the button once the script loads', async () => {
    render(<GoogleSignInButton onSuccess={vi.fn()} onError={vi.fn()} />)

    await waitFor(() => {
      expect(initializeMock).toHaveBeenCalledWith(expect.objectContaining({ callback: expect.any(Function) }))
      expect(renderButtonMock).toHaveBeenCalled()
    })
  })

  it('signs in with the credential returned by Google and calls onSuccess', async () => {
    signInWithCredentialMock.mockResolvedValueOnce(undefined)
    const onSuccess = vi.fn()
    render(<GoogleSignInButton onSuccess={onSuccess} onError={vi.fn()} />)

    await waitFor(() => expect(initializeMock).toHaveBeenCalled())
    const callback = initializeMock.mock.calls[0]![0].callback
    callback({ credential: 'the-id-token' })

    await waitFor(() => {
      expect(credentialMock).toHaveBeenCalledWith('the-id-token')
      expect(signInWithCredentialMock).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('calls onError with the real Firebase error code when signInWithCredential fails', async () => {
    signInWithCredentialMock.mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'auth/invalid-credential' }))
    const onError = vi.fn()
    render(<GoogleSignInButton onSuccess={vi.fn()} onError={onError} />)

    await waitFor(() => expect(initializeMock).toHaveBeenCalled())
    const callback = initializeMock.mock.calls[0]![0].callback
    callback({ credential: 'the-id-token' })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('auth/invalid-credential'))
    })
  })
})
