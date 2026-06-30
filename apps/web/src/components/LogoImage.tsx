'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

interface LogoImageProps {
  path: string
  className?: string
}

export function LogoImage({ path, className }: LogoImageProps) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['image-url', path],
    queryFn: () => api.getImageUrl(path),
  })

  if (isLoading || !url) {
    return <div className={`animate-pulse rounded-full bg-card-2 ${className ?? ''}`} />
  }

  // object-cover (não contain) para a marca preencher todo o círculo, sem halo de fundo sobrando.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Logo da marca" className={`object-cover ${className ?? ''}`} />
}
