'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface LogoImageProps {
  path: string
  className?: string
  fit?: 'cover' | 'contain'
}

export function LogoImage({ path, className, fit = 'cover' }: LogoImageProps) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading || !url) {
    return <div className={`animate-pulse rounded-full bg-card-2 ${className ?? ''}`} />
  }

  // object-cover preenche avatares circulares/quadrados sem halo de fundo sobrando.
  // object-contain evita cortar/esticar o logo quando o box não é quadrado (ex.: card largo do dashboard).
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Logo da marca" className={`${fitClass} ${className ?? ''}`} />
}
