import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getAllowedWebOrigins, resolveWebOrigin } from './webOrigin.js'

describe('webOrigin', () => {
  const originalCorsOrigins = process.env['CORS_ORIGINS']
  const originalWebUrl = process.env['WEB_URL']

  beforeEach(() => {
    delete process.env['CORS_ORIGINS']
    delete process.env['WEB_URL']
  })

  afterEach(() => {
    if (originalCorsOrigins === undefined) delete process.env['CORS_ORIGINS']
    else process.env['CORS_ORIGINS'] = originalCorsOrigins
    if (originalWebUrl === undefined) delete process.env['WEB_URL']
    else process.env['WEB_URL'] = originalWebUrl
  })

  describe('getAllowedWebOrigins', () => {
    it('defaults to localhost when nothing is configured', () => {
      expect(getAllowedWebOrigins()).toEqual(['http://localhost:3000'])
    })

    it('falls back to WEB_URL when CORS_ORIGINS is not set', () => {
      process.env['WEB_URL'] = 'https://radiokactus.com'
      expect(getAllowedWebOrigins()).toEqual(['https://radiokactus.com'])
    })

    it('splits CORS_ORIGINS on commas and trims whitespace', () => {
      process.env['CORS_ORIGINS'] = 'https://socialshelf.com.br, https://radiokactus.com'
      expect(getAllowedWebOrigins()).toEqual([
        'https://socialshelf.com.br',
        'https://radiokactus.com',
      ])
    })

    it('prefers CORS_ORIGINS over WEB_URL when both are set', () => {
      process.env['WEB_URL'] = 'https://radiokactus.com'
      process.env['CORS_ORIGINS'] = 'https://socialshelf.com.br'
      expect(getAllowedWebOrigins()).toEqual(['https://socialshelf.com.br'])
    })
  })

  describe('resolveWebOrigin', () => {
    it('returns the request origin when it is in the allow-list', () => {
      process.env['CORS_ORIGINS'] = 'https://socialshelf.com.br,https://radiokactus.com'
      expect(resolveWebOrigin('https://socialshelf.com.br')).toBe('https://socialshelf.com.br')
    })

    it('returns undefined when the request origin is not in the allow-list', () => {
      process.env['CORS_ORIGINS'] = 'https://socialshelf.com.br,https://radiokactus.com'
      expect(resolveWebOrigin('https://attacker.example')).toBeUndefined()
    })

    it('returns undefined when no origin header is present', () => {
      process.env['CORS_ORIGINS'] = 'https://socialshelf.com.br'
      expect(resolveWebOrigin(undefined)).toBeUndefined()
    })
  })
})
