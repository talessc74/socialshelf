import { describe, it, expect, beforeEach } from 'vitest'
import { GenerateInstagramAuthUrlUseCase } from './GenerateInstagramAuthUrlUseCase.js'
import { validateState } from '../../lib/csrf.js'

describe('GenerateInstagramAuthUrlUseCase', () => {
  let useCase: GenerateInstagramAuthUrlUseCase

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['INSTAGRAM_APP_ID'] = 'test-instagram-app-id'
    process.env['INSTAGRAM_REDIRECT_URI'] = 'http://localhost:3001/oauth/instagram/callback'
    useCase = new GenerateInstagramAuthUrlUseCase()
  })

  it('returns an Instagram OAuth authorization URL (not Facebook)', () => {
    const { url } = useCase.execute('user-123', 'brand-123')
    expect(url).toContain('https://www.instagram.com/oauth/authorize')
    expect(url).toContain('client_id=test-instagram-app-id')
    expect(url).toContain('response_type=code')
    expect(url).not.toContain('facebook.com')
  })

  it('requests the Instagram Login business scopes', () => {
    const { url } = useCase.execute('user-123', 'brand-123')
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('instagram_business_basic')
    expect(decoded).toContain('instagram_business_content_publish')
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
