import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewsCard } from './NewsCard'
import type { ApiTopicSuggestion } from '../lib/api'

function makeTopicSuggestion(overrides: Partial<ApiTopicSuggestion> = {}): ApiTopicSuggestion {
  return {
    id: 'topic-1',
    brandId: 'user-1',
    headline: 'Notícia relevante',
    summary: 'Resumo da notícia.',
    sourceUrl: 'https://www.ft.com/content/some-article',
    sourceDomain: 'ft.com',
    rationale: 'rationale',
    audienceFitScore: 1.8,
    thumbnailUrl: null,
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
})
