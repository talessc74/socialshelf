import { describe, it, expect, beforeEach } from 'vitest'
import { GenerateLinkedInPageAuthUrlUseCase } from './GenerateLinkedInPageAuthUrlUseCase.js'
import { validateState } from '../../lib/csrf.js'

describe('GenerateLinkedInPageAuthUrlUseCase', () => {
  let useCase: GenerateLinkedInPageAuthUrlUseCase

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['LINKEDIN_PAGE_CLIENT_ID'] = 'test-page-client-id'
    process.env['LINKEDIN_PAGE_REDIRECT_URI'] = 'http://localhost:3001/oauth/linkedin-page/callback'
    useCase = new GenerateLinkedInPageAuthUrlUseCase()
  })

  it('returns a LinkedIn authorization URL using the page app client id', () => {
    const { url } = useCase.execute('user-123', 'brand-123')
    expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization')
    expect(url).toContain('client_id=test-page-client-id')
    expect(url).toContain('response_type=code')
  })

  it('includes organization scopes, not member-social scopes', () => {
    const { url } = useCase.execute('user-123', 'brand-123')
    expect(decodeURIComponent(url)).toContain('r_organization_admin')
    expect(decodeURIComponent(url)).toContain('w_organization_social')
    expect(decodeURIComponent(url)).not.toContain('w_member_social')
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
})
