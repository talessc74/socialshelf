import { describe, it, expect, afterEach } from 'vitest'
import { verifyNewsItem, getTrustedDomains } from './factVerification.js'
import type { NewsItem } from '@socialshelf/domain'

function makeItem(sourceUrl: string): NewsItem {
  return {
    title: 'Headline',
    summary: 'Summary',
    sourceUrl,
    sourceName: 'Source',
    publishedAt: new Date('2026-06-01T00:00:00Z'),
  }
}

describe('verifyNewsItem', () => {
  it('verifies an item whose URL domain is in the trusted list', () => {
    const result = verifyNewsItem(makeItem('https://www.reuters.com/article/123'), ['reuters.com'])

    expect(result).not.toBeNull()
    expect(result?.sourceDomain).toBe('reuters.com')
    expect(result?.verifiedAt).toBeInstanceOf(Date)
  })

  it('verifies an item whose domain is a subdomain of a trusted domain', () => {
    const result = verifyNewsItem(makeItem('https://news.bbc.com/story'), ['bbc.com'])

    expect(result).not.toBeNull()
    expect(result?.sourceDomain).toBe('news.bbc.com')
  })

  it('discards an item whose domain is not in the trusted list', () => {
    const result = verifyNewsItem(makeItem('https://random-blog.example/post'), ['reuters.com'])

    expect(result).toBeNull()
  })

  it('discards an item with a malformed URL', () => {
    const result = verifyNewsItem(makeItem('not-a-url'), ['reuters.com'])

    expect(result).toBeNull()
  })

  it('discards a non-https URL even on a trusted domain', () => {
    const result = verifyNewsItem(makeItem('http://reuters.com/article/123'), ['reuters.com'])

    expect(result).toBeNull()
  })
})

describe('getTrustedDomains', () => {
  afterEach(() => {
    delete process.env['TRUSTED_NEWS_DOMAINS']
  })

  it('returns the default list when TRUSTED_NEWS_DOMAINS is unset', () => {
    const domains = getTrustedDomains()
    expect(domains).toContain('reuters.com')
  })

  it('parses a comma-separated list from TRUSTED_NEWS_DOMAINS', () => {
    process.env['TRUSTED_NEWS_DOMAINS'] = 'example.com, Other.com'
    const domains = getTrustedDomains()
    expect(domains).toEqual(['example.com', 'other.com'])
  })
})
