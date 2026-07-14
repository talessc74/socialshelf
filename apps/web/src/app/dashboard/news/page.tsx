'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api'
import { pickTopNewsInsight } from '../../../lib/selfieNewsInsight'
import { useSelfieNarrateOnReady } from '../../../contexts/AssistantContext'
import { NewsCarousel } from '../../../components/NewsCarousel'
import { NewsSearch } from '../../../components/NewsSearch'

export default function NewsPage() {
  // Mesma queryKey de NewsCarousel — React Query compartilha o cache/fetch,
  // sem requisição duplicada. Fica na página (não no componente
  // compartilhado) porque NewsCarousel também aparece no Início e em
  // Insights, onde essa narração não deve disparar.
  const { data: suggestions } = useQuery({
    queryKey: ['topic-suggestions'],
    queryFn: () => api.getTopicSuggestions(),
  })
  useSelfieNarrateOnReady(suggestions ? pickTopNewsInsight(suggestions) : null)

  return (
    <div className="space-y-6">
      <NewsSearch />
      <NewsCarousel />
    </div>
  )
}
