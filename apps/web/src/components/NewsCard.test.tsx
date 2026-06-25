import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NewsCard } from './NewsCard'
import type { ApiTopicSuggestion } from '../lib/api'
import { Platform } from '@socialshelf/domain'

function makeTopicSuggestion(overrides: Partial<ApiTopicSuggestion> = {}): ApiTopicSuggestion {
  return {
    id: 'topic-1',
    brandId: 'user-1',
    headline: 'Notícia relevante',
    summary: 'Resumo da notícia.',
    sourceUrl: 'https://www.ft.com/content/some-article',
    sourceDomain: 'ft.com',
    articleUrl: 'https://news.google.com/rss/articles/abc',
    rationale: 'rationale',
    audienceFitScore: 1.8,
    thumbnailUrl: null,
    publishedPlatforms: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('NewsCard', () => {
  it('links the source domain to the original article in a new tab', () => {
    render(<NewsCard suggestion={makeTopicSuggestion()} />)

    const sourceLink = screen.getByRole('link', { name: /ft\.com/ })
    expect(sourceLink).toHaveAttribute('href', 'https://www.ft.com/content/some-article')
    expect(sourceLink).toHaveAttribute('target', '_blank')
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows the source logo when the news item has no thumbnail', () => {
    render(<NewsCard suggestion={makeTopicSuggestion({ thumbnailUrl: null })} />)

    const logo = screen.getByRole('img', { name: 'Logo de ft.com' })
    expect(logo).toHaveAttribute('src', expect.stringContaining('domain=ft.com'))
  })

  it('falls back to the generic icon when the source logo fails to load', () => {
    render(<NewsCard suggestion={makeTopicSuggestion({ thumbnailUrl: null })} />)

    const logo = screen.getByRole('img', { name: 'Logo de ft.com' })
    fireEvent.error(logo)

    expect(screen.queryByRole('img', { name: 'Logo de ft.com' })).not.toBeInTheDocument()
  })

  it('shows no platform badge when the news has not been published yet', () => {
    render(<NewsCard suggestion={makeTopicSuggestion({ publishedPlatforms: [] })} />)

    expect(screen.queryByLabelText(/Já publicada/)).not.toBeInTheDocument()
  })

  it('marks the news with a badge for each platform it was already published to', () => {
    render(
      <NewsCard
        suggestion={makeTopicSuggestion({ publishedPlatforms: [Platform.INSTAGRAM, Platform.LINKEDIN] })}
      />,
    )

    expect(screen.getByLabelText('Já publicada no Instagram')).toBeInTheDocument()
    expect(screen.getByLabelText('Já publicada no LinkedIn')).toBeInTheDocument()
  })
})
