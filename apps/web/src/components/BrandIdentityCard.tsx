import Link from 'next/link'
import type { ApiBrandProfile } from '../lib/api'
import { LogoImage } from './LogoImage'

interface BrandIdentityCardProps {
  brandProfile: ApiBrandProfile
}

export function BrandIdentityCard({ brandProfile }: BrandIdentityCardProps) {
  const { business, identity, visual } = brandProfile

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {visual.logoStoragePath ? (
          <LogoImage path={visual.logoStoragePath} className="h-14 w-14 shrink-0 rounded-xl border border-line" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card-2 text-xs text-muted-2">
            Sem logo
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base font-bold text-ink">{business.name || 'Marca sem nome'}</p>
          <p className="text-xs text-muted">{business.segment || 'Segmento não definido'}</p>
          {identity.positioning && (
            <p className="mt-1 break-words text-xs text-muted-2">{identity.positioning}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 gap-1.5">
          <span
            className="h-6 w-6 rounded-full border border-line"
            style={{ backgroundColor: visual.primaryColor }}
            title="Cor primária"
          />
          <span
            className="h-6 w-6 rounded-full border border-line"
            style={{ backgroundColor: visual.secondaryColor }}
            title="Cor secundária"
          />
        </span>
        <Link href="/dashboard/brand" className="whitespace-nowrap text-xs font-semibold text-accent hover:underline">
          Editar marca →
        </Link>
      </div>
    </div>
  )
}
