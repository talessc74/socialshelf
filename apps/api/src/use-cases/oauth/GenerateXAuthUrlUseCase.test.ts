import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateXAuthUrlUseCase } from './GenerateXAuthUrlUseCase.js'

vi.mock('../../lib/x-client.js', () => ({
  generatePkce: vi.fn().mockReturnValue({
    codeVerifier: 'mock-verifier-32-bytes-base64url-ok',
    codeChallenge: 'mock-challenge-s256',
  }),
  buildXAuthUrl: vi.fn().mockReturnValue('https://twitter.com/i/oauth2/authorize?mocked=1'),
}))

describe('GenerateXAuthUrlUseCase', () => {
  let useCase: GenerateXAuthUrlUseCase

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['X_CLIENT_ID'] = 'test-x-client-id'
    process.env['X_REDIRECT_URI'] = 'http://localhost:3001/oauth/x/callback'
    useCase = new GenerateXAuthUrlUseCase()
  })

  it('returns a URL containing twitter.com', () => {
    const { url } = useCase.execute('user-abc')
    expect(url).toContain('twitter.com')
  })

  it('returns a non-empty codeVerifier', () => {
    const { codeVerifier } = useCase.execute('user-abc')
    expect(codeVerifier.length).toBeGreaterThan(0)
  })

  it('returns a signed state string', () => {
    const { state } = useCase.execute('user-abc')
    expect(state).toMatch(/^[^.]+\.[^.]+$/)
  })

  it('produces different states for different users', () => {
    const result1 = useCase.execute('user-1')
    const result2 = useCase.execute('user-2')
    expect(result1.state).not.toBe(result2.state)
  })
})
