import { describe, it, expect, beforeEach } from 'vitest'
import { GenerateLinkedInAuthUrlUseCase } from './GenerateLinkedInAuthUrlUseCase.js'
import { validateState } from '../../lib/csrf.js'

describe('GenerateLinkedInAuthUrlUseCase', () => {
  let useCase: GenerateLinkedInAuthUrlUseCase

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['LINKEDIN_CLIENT_ID'] = 'test-client-id'
    process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin/callback'
    useCase = new GenerateLinkedInAuthUrlUseCase()
  })

  it('returns a LinkedIn authorization URL', () => {
    const { url } = useCase.execute('user-123', 'brand-123')
    expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization')
    expect(url).toContain('client_id=test-client-id')
    expect(url).toContain('response_type=code')
    expect(url).toContain('w_member_social')
  })

  it('embeds a verifiable state with the userId', () => {
    const { url, state } = useCase.execute('user-123', 'brand-123')
    expect(url).toContain(encodeURIComponent(state))
    const { userId } = validateState(state)
    expect(userId).toBe('user-123')
  })

  it('generates a unique state on each call', () => {
    const { state: s1 } = useCase.execute('user-123', 'brand-123')
    const { state: s2 } = useCase.execute('user-123', 'brand-123')
    expect(s1).not.toBe(s2)
  })

  it('includes all required OAuth scopes', () => {
    const { url } = useCase.execute('user-123', 'brand-123')
    expect(decodeURIComponent(url)).toContain('openid')
    expect(decodeURIComponent(url)).toContain('profile')
    expect(decodeURIComponent(url)).toContain('email')
    expect(decodeURIComponent(url)).toContain('w_member_social')
  })
})
