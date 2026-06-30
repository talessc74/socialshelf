import { LogoImage } from './LogoImage'

interface BrandPostPreviewProps {
  primaryColor: string
  logoStoragePath: string | null
  headline?: string
}

export function BrandPostPreview({
  primaryColor,
  logoStoragePath,
  headline = 'Assim vai ficar o destaque dos seus posts',
}: BrandPostPreviewProps) {
  return (
    <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-card-2">
      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-2">
        Sua imagem aqui
      </div>

      <div
        className="absolute inset-x-0 bottom-0 flex h-1/4 items-center justify-center px-4 text-center"
        style={{ backgroundColor: primaryColor }}
      >
        <p className="text-sm font-bold leading-tight text-white">{headline}</p>
      </div>

      {logoStoragePath && (
        <LogoImage
          path={logoStoragePath}
          className="absolute top-[4%] left-[4%] h-[9%] w-[9%] rounded-full"
        />
      )}
    </div>
  )
}
