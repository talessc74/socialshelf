import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateTikTokAuthUrlUseCase } from './GenerateTikTokAuthUrlUseCase.js'
import { validateState } from '../../lib/csrf.js'

vi.mock('../../lib/tiktok-client.js', () => ({
  generatePkce: vi.fn().mockReturnValue({
    codeVerifier: 'mock-verifier-32-bytes-base64url-ok',
    codeChallenge: 'mock-challenge-s256',
  }),
  buildTikTokAuthUrl: vi.fn().mockReturnValue('https://www.tiktok.com/v2/auth/authorize/?mocked=1'),
}))

describe('GenerateTikTokAuthUrlUseCase', () => {
  let useCase: GenerateTikTokAuthUrlUseCase

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['TIKTOK_CLIENT_KEY'] = 'test-tiktok-client-key'
    process.env['TIKTOK_REDIRECT_URI'] = 'http://localhost:3001/oauth/tiktok/callback'
    useCase = new GenerateTikTokAuthUrlUseCase()
  })

  it('returns a URL containing tiktok.com', () => {
    const { url } = useCase.execute('user-abc', 'brand-abc')
    expect(url).toContain('tiktok.com')
  })

  it('embeds codeVerifier in the state JWT', () => {
    const { state } = useCase.execute('user-abc', 'brand-abc')
    const { codeVerifier } = validateState(state)
    expect(codeVerifier).toBe('mock-verifier-32-bytes-base64url-ok')
  })

  it('returns a signed state string', () => {
    const { state } = useCase.execute('user-abc', 'brand-abc')
    expect(state).toMatch(/^[^.]+\.[^.]+$/)
  })

  it('produces different states for different users', () => {
    const result1 = useCase.execute('user-1', 'brand-1')
    const result2 = useCase.execute('user-2', 'brand-2')
    expect(result1.state).not.toBe(result2.state)
  })
})
