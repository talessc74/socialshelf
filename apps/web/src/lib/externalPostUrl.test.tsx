import { describe, it, expect } from 'vitest'
import { Platform } from '@socialshelf/domain'
import { externalPostUrl } from './externalPostUrl'

describe('externalPostUrl', () => {
  it('builds an X status link from the tweet id', () => {
    expect(externalPostUrl(Platform.TWITTER, '12345')).toBe('https://x.com/i/web/status/12345')
  })

  it('builds a LinkedIn feed update link from the urn', () => {
    expect(externalPostUrl(Platform.LINKEDIN, 'urn:li:ugcPost:456')).toBe(
      'https://www.linkedin.com/feed/update/urn:li:ugcPost:456/',
    )
  })

  it('builds a Facebook permalink from the page-scoped post id', () => {
    expect(externalPostUrl(Platform.FACEBOOK, '111_222')).toBe('https://www.facebook.com/111_222')
  })

  it('returns null for Instagram (media id is not the permalink shortcode)', () => {
    expect(externalPostUrl(Platform.INSTAGRAM, 'media-1')).toBeNull()
  })

  it('returns null for TikTok (async publish id is not a video link)', () => {
    expect(externalPostUrl(Platform.TIKTOK, 'publish-1')).toBeNull()
  })
})
