import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LogoImage } from './LogoImage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getImageUrl: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function renderLogo(props: Parameters<typeof LogoImage>[0]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LogoImage {...props} />
    </QueryClientProvider>,
  )
}

describe('LogoImage', () => {
  it('defaults to object-cover when fit is not provided', async () => {
    mockedApi.getImageUrl.mockResolvedValue('https://example.com/logo.png')

    renderLogo({ path: 'brands/1/logo.png' })

    const img = await screen.findByAltText('Logo da marca')
    expect(img).toHaveClass('object-cover')
    expect(img).not.toHaveClass('object-contain')
  })

  it('uses object-contain when fit="contain" is passed, to avoid cropping/stretching non-square logos', async () => {
    mockedApi.getImageUrl.mockResolvedValue('https://example.com/logo.png')

    renderLogo({ path: 'brands/1/logo.png', fit: 'contain' })

    const img = await screen.findByAltText('Logo da marca')
    expect(img).toHaveClass('object-contain')
    expect(img).not.toHaveClass('object-cover')
  })
})
