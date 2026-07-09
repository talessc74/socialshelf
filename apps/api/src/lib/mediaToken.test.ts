import { createHmac } from 'crypto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyMediaToken } from './mediaToken.js'

const SECRET = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'

function sign(path: string, exp: number): string {
  const payload = Buffer.from(JSON.stringify({ path, exp })).toString('base64url')
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

describe('verifyMediaToken', () => {
  beforeEach(() => {
    process.env['CSRF_SECRET'] = SECRET
  })

  afterEach(() => {
    delete process.env['CSRF_SECRET']
  })

  it('accepts a valid, unexpired token for the matching path', () => {
    const token = sign('videos/user-1/brand-1/clip.mp4', Date.now() + 60_000)
    expect(verifyMediaToken(token, 'videos/user-1/brand-1/clip.mp4')).toBe(true)
  })

  it('rejects a token signed for a different path', () => {
    const token = sign('videos/user-1/brand-1/clip.mp4', Date.now() + 60_000)
    expect(verifyMediaToken(token, 'videos/other/path.mp4')).toBe(false)
  })

  it('rejects an expired token', () => {
    const token = sign('videos/user-1/brand-1/clip.mp4', Date.now() - 1000)
    expect(verifyMediaToken(token, 'videos/user-1/brand-1/clip.mp4')).toBe(false)
  })

  it('rejects a token with a tampered signature', () => {
    const token = sign('videos/user-1/brand-1/clip.mp4', Date.now() + 60_000)
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifyMediaToken(tampered, 'videos/user-1/brand-1/clip.mp4')).toBe(false)
  })

  it('rejects a malformed token', () => {
    expect(verifyMediaToken('not-a-token', 'videos/user-1/brand-1/clip.mp4')).toBe(false)
  })

  it('throws when CSRF_SECRET is missing', () => {
    delete process.env['CSRF_SECRET']
    expect(() => verifyMediaToken('a.b', 'videos/x')).toThrow('CSRF_SECRET is required')
  })
})
