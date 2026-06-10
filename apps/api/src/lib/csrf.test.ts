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
      const state = generateState('user-123')
      expect(state).toContain('.')
    })

    it('generates unique state on each call', () => {
      const s1 = generateState('user-123')
      const s2 = generateState('user-123')
      expect(s1).not.toBe(s2)
    })
  })

  describe('validateState', () => {
    it('returns userId for a valid state', () => {
      const state = generateState('user-abc')
      const { userId } = validateState(state)
      expect(userId).toBe('user-abc')
    })

    it('throws on tampered signature', () => {
      const state = generateState('user-abc')
      const tampered = state.slice(0, -4) + 'XXXX'
      expect(() => validateState(tampered)).toThrow('Invalid state signature')
    })

    it('throws on malformed state (no dot)', () => {
      expect(() => validateState('nodothere')).toThrow('Invalid state format')
    })

    it('throws on expired state', () => {
      const ELEVEN_MINUTES_AGO = Date.now() - 11 * 60 * 1000
      vi.spyOn(Date, 'now').mockReturnValueOnce(ELEVEN_MINUTES_AGO)
      const state = generateState('user-abc')
      vi.restoreAllMocks()
      expect(() => validateState(state)).toThrow('State expired')
    })

    it('throws when CSRF_SECRET is missing', () => {
      delete process.env['CSRF_SECRET']
      expect(() => generateState('user-abc')).toThrow('CSRF_SECRET is required')
    })
  })
})
