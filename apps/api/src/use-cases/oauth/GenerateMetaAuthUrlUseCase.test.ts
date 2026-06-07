import { describe, it, expect, beforeEach } from 'vitest'
import { GenerateMetaAuthUrlUseCase } from './GenerateMetaAuthUrlUseCase.js'
import { validateState } from '../../lib/csrf.js'

describe('GenerateMetaAuthUrlUseCase', () => {
  let useCase: GenerateMetaAuthUrlUseCase

  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
    process.env['META_APP_ID'] = 'test-meta-app-id'
    process.env['META_REDIRECT_URI'] = 'http://localhost:3001/oauth/meta/callback'
    useCase = new GenerateMetaAuthUrlUseCase()
  })

  it('returns a Facebook OAuth authorization URL', () => {
    const { url } = useCase.execute('user-123')
    expect(url).toContain('https://www.facebook.com/dialog/oauth')
    expect(url).toContain('client_id=test-meta-app-id')
    expect(url).toContain('response_type=code')
  })

  it('includes all required scopes for Instagram and Facebook', () => {
    const { url } = useCase.execute('user-123')
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('pages_manage_posts')
    expect(decoded).toContain('instagram_content_publish')
    expect(decoded).toContain('pages_show_list')
  })

  it('embeds a verifiable state with the userId', () => {
    const { url, state } = useCase.execute('user-123')
    expect(url).toContain(encodeURIComponent(state))
    const { userId } = validateState(state)
    expect(userId).toBe('user-123')
  })

  it('generates a unique state on each call', () => {
    const { state: s1 } = useCase.execute('user-123')
    const { state: s2 } = useCase.execute('user-123')
    expect(s1).not.toBe(s2)
  })
})
