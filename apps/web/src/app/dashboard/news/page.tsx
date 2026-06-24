'use client'

import { NewsCarousel } from '../../../components/NewsCarousel'
import { NewsSearch } from '../../../components/NewsSearch'

export default function NewsPage() {
  return (
    <div className="space-y-6">
      <NewsSearch />
      <NewsCarousel />
    </div>
  )
}
