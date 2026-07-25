import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import { PostDetailModal } from './PostDetailModal'
import { api, type ApiPost } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getImageUrl: vi.fn(),
    getVideoUrl: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makePost(overrides: Partial<ApiPost> = {}): ApiPost {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'user-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.INSTAGRAM, text: 'Texto publicado no Instagram' }],
    imageStoragePaths: [],
    videoStoragePath: null,
    status: 'published',
    origin: 'manual',
    externalIds: {},
    scheduledAt: null,
    publishedAt: new Date('2026-06-20T15:00:00.000Z').toISOString(),
    imagesDeletedAt: null,
    savedForLater: false,
    createdAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function renderModal(post: ApiPost, onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PostDetailModal post={post} onClose={onClose} />
    </QueryClientProvider>,
  )
}

describe('PostDetailModal', () => {
  it('shows the full, non-truncated text per platform', () => {
    const longText = 'Um texto bem mais longo do que qualquer prévia truncada mostraria por completo'
    renderModal(makePost({ content: [{ platform: Platform.INSTAGRAM, text: longText }] }))

    expect(screen.getByText(longText)).toBeInTheDocument()
  })

  it('shows the "Automático" badge only when origin is autonomy-tick', () => {
    renderModal(makePost({ origin: 'autonomy-tick' }))
    expect(screen.getByText('🤖 Automático')).toBeInTheDocument()
  })

  it('does not show the "Automático" badge for a manually created post', () => {
    renderModal(makePost({ origin: 'manual' }))
    expect(screen.queryByText('🤖 Automático')).not.toBeInTheDocument()
  })

  it('shows the "Campanha" badge only when origin is campaign', () => {
    renderModal(makePost({ origin: 'campaign' }))
    expect(screen.getByText('📸 Campanha')).toBeInTheDocument()
  })

  it('renders an image for every path in imageStoragePaths', async () => {
    mockedApi.getImageUrl.mockImplementation(async (path) => `https://example.com/${path}`)
    const { container } = renderModal(makePost({ imageStoragePaths: ['a.png', 'b.png'] }))

    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
  })

  it('renders a video when videoStoragePath is set', async () => {
    mockedApi.getVideoUrl.mockResolvedValue('https://example.com/video.mp4')
    const { container } = renderModal(makePost({ videoStoragePath: 'video.mp4' }))

    await waitFor(() => expect(container.querySelector('video')).toBeInTheDocument())
  })

  it('shows an external link for a platform whose URL is constructible (X)', () => {
    renderModal(
      makePost({
        content: [{ platform: Platform.TWITTER, text: 'Tweet publicado' }],
        externalIds: { [Platform.TWITTER]: '12345' },
      }),
    )

    const link = screen.getByRole('link', { name: /Ver no X/ })
    expect(link).toHaveAttribute('href', 'https://x.com/i/web/status/12345')
  })

  it('does not show an external link for a platform whose URL is not constructible (Instagram)', () => {
    renderModal(
      makePost({
        content: [{ platform: Platform.INSTAGRAM, text: 'Post do Instagram' }],
        externalIds: { [Platform.INSTAGRAM]: 'media-1' },
      }),
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('marks a targeted platform that did not publish (no externalId on a published post)', () => {
    renderModal(
      makePost({
        status: 'published',
        content: [
          { platform: Platform.FACEBOOK, text: 'Publicado no Facebook' },
          { platform: Platform.INSTAGRAM, text: 'Deveria ter ido pro Instagram' },
        ],
        externalIds: { [Platform.FACEBOOK]: 'fb-1' },
      }),
    )

    expect(screen.getByText('✕ não publicou')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    renderModal(makePost(), onClose)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar ✕' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking the backdrop but not when clicking inside the dialog', () => {
    const onClose = vi.fn()
    renderModal(makePost(), onClose)

    fireEvent.click(within(screen.getByRole('dialog')).getByText('Post completo'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
