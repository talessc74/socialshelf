import Link from 'next/link'
import type { ApiBrandProfile } from '../lib/api'
import { LogoImage } from './LogoImage'

interface BrandIdentityCardProps {
  brandProfile: ApiBrandProfile
}

export function BrandIdentityCard({ brandProfile }: BrandIdentityCardProps) {
  const { business, identity, visual } = brandProfile

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm shadow-brand-100/60 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {visual.logoStoragePath ? (
          <LogoImage path={visual.logoStoragePath} className="h-14 w-14 shrink-0 rounded-xl border border-gray-100" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xs text-gray-400">
            Sem logo
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900">{business.name || 'Marca sem nome'}</p>
          <p className="text-xs text-gray-500">{business.segment || 'Segmento não definido'}</p>
          {identity.positioning && (
            <p className="mt-1 break-words text-xs text-gray-400">{identity.positioning}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 gap-1.5">
          <span
            className="h-6 w-6 rounded-full border border-gray-200"
            style={{ backgroundColor: visual.primaryColor }}
            title="Cor primária"
          />
          <span
            className="h-6 w-6 rounded-full border border-gray-200"
            style={{ backgroundColor: visual.secondaryColor }}
            title="Cor secundária"
          />
        </span>
        <Link href="/dashboard/brand" className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:underline">
          Editar marca →
        </Link>
      </div>
    </div>
  )
}
