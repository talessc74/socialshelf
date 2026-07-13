import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateStyle } from '@socialshelf/domain'
import { TemplateStyleThumbnail } from './TemplateStyleThumbnail'

describe('TemplateStyleThumbnail', () => {
  it('renders a bottom bar in the brand color for BOLD_BOTTOM', () => {
    const { container } = render(<TemplateStyleThumbnail style={TemplateStyle.BOLD_BOTTOM} primaryColor="#ff0000" />)

    const bar = container.querySelector('.absolute.inset-x-0.bottom-0')
    expect(bar).toHaveStyle({ backgroundColor: '#ff0000' })
  })

  it('renders a top bar in the brand color for TOP_STRIP', () => {
    const { container } = render(<TemplateStyleThumbnail style={TemplateStyle.TOP_STRIP} primaryColor="#00ff00" />)

    const bar = container.querySelector('.absolute.inset-x-0.top-0')
    expect(bar).toHaveStyle({ backgroundColor: '#00ff00' })
  })

  it('renders a dark gradient overlay for CENTERED_OVERLAY, not a solid brand-colored bar', () => {
    const { container } = render(
      <TemplateStyleThumbnail style={TemplateStyle.CENTERED_OVERLAY} primaryColor="#ff0000" />,
    )

    expect(container.querySelector('.absolute.inset-x-0.bottom-0.h-2\\/5')).not.toBeInTheDocument()
    expect(container.querySelector('.absolute.inset-x-0.top-0.h-2\\/5')).not.toBeInTheDocument()
  })

  it('renders no bar or overlay for NO_TEXT', () => {
    const { container } = render(<TemplateStyleThumbnail style={TemplateStyle.NO_TEXT} primaryColor="#ff0000" />)

    expect(container.querySelectorAll('.absolute')).toHaveLength(0)
  })
})
