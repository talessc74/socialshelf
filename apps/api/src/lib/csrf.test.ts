import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateState, validateState } from './csrf.js'

describe('csrf', () => {
  beforeEach(() => {
    process.env['CSRF_SECRET'] = 'test-secret-64-chars-long-enough-for-hmac-sha256-signing'
  })

  afterEach(() => {
    delete process.env['CSRF_SECRET']
  })

  describe('generateState', () => {
    it('returns a dot-separated payload.signature string', () => {
      const state = generateState('user-123', 'brand-123')
      expect(state).toContain('.')
    })

    it('generates unique state on each call', () => {
      const s1 = generateState('user-123', 'brand-123')
      const s2 = generateState('user-123', 'brand-123')
      expect(s1).not.toBe(s2)
    })

    it('embeds codeVerifier when provided', () => {
      const state = generateState('user-123', 'brand-123', 'my-verifier')
      const { codeVerifier } = validateState(state)
      expect(codeVerifier).toBe('my-verifier')
    })

    it('omits codeVerifier when not provided', () => {
      const state = generateState('user-123', 'brand-123')
      const { codeVerifier } = validateState(state)
      expect(codeVerifier).toBeUndefined()
    })
  })

  describe('validateState', () => {
    it('returns userId for a valid state', () => {
      const state = generateState('user-abc', 'brand-abc')
      const { userId } = validateState(state)
      expect(userId).toBe('user-abc')
    })

    it('returns brandId for a valid state', () => {
      const state = generateState('user-abc', 'brand-xyz')
      const { brandId } = validateState(state)
      expect(brandId).toBe('brand-xyz')
    })

    it('returns userId and codeVerifier for state with embedded verifier', () => {
      const state = generateState('user-abc', 'brand-abc', 'verifier-xyz')
      const { userId, codeVerifier } = validateState(state)
      expect(userId).toBe('user-abc')
      expect(codeVerifier).toBe('verifier-xyz')
    })

    it('throws on tampered signature', () => {
      const state = generateState('user-abc', 'brand-abc')
      const tampered = state.slice(0, -4) + 'XXXX'
      expect(() => validateState(tampered)).toThrow('Invalid state signature')
    })

    it('throws on malformed state (no dot)', () => {
      expect(() => validateState('nodothere')).toThrow('Invalid state format')
    })

    it('throws on expired state', () => {
      const ELEVEN_MINUTES_AGO = Date.now() - 11 * 60 * 1000
      vi.spyOn(Date, 'now').mockReturnValueOnce(ELEVEN_MINUTES_AGO)
      const state = generateState('user-abc', 'brand-abc')
      vi.restoreAllMocks()
      expect(() => validateState(state)).toThrow('State expired')
    })

    it('throws when CSRF_SECRET is missing', () => {
      delete process.env['CSRF_SECRET']
      expect(() => generateState('user-abc', 'brand-abc')).toThrow('CSRF_SECRET is required')
    })
  })
})
