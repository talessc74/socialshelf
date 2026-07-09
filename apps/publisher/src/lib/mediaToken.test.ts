import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { signMediaPath } from './mediaToken.js'

describe('signMediaPath', () => {
  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
  })

  afterEach(() => {
    delete process.env['CSRF_SECRET']
  })

  it('produces a payload.signature token', () => {
    const token = signMediaPath('videos/user-1/brand-1/clip.mp4')
    expect(token.split('.')).toHaveLength(2)
  })

  it('embeds the path and a future expiry in the payload', () => {
    const token = signMediaPath('videos/user-1/brand-1/clip.mp4')
    const [payload] = token.split('.')
    const decoded = JSON.parse(Buffer.from(payload!, 'base64url').toString()) as { path: string; exp: number }
    expect(decoded.path).toBe('videos/user-1/brand-1/clip.mp4')
    expect(decoded.exp).toBeGreaterThan(Date.now())
  })

  it('throws when CSRF_SECRET is missing', () => {
    delete process.env['CSRF_SECRET']
    expect(() => signMediaPath('videos/x/y/z.mp4')).toThrow('CSRF_SECRET is required')
  })
})
