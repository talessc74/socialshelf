import { TemplateStyle } from '@socialshelf/domain'

interface TemplateStyleThumbnailProps {
  style: TemplateStyle
  primaryColor: string
}

// Miniatura só de CSS (sem imagem real gerada) pra dar noção visual de cada estilo na lista de
// preferência — mesma técnica de barra sólida colorida já usada em BrandPostPreview, só que
// compacta e cobrindo os 4 estilos em vez de só "Faixa inferior". Usa a cor primária da própria
// marca em vez de um exemplo genérico, pra já dar a sensação de como vai ficar.
export function TemplateStyleThumbnail({ style, primaryColor }: TemplateStyleThumbnailProps) {
  return (
    <div
      aria-hidden="true"
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-card-2"
    >
      {style === TemplateStyle.BOLD_BOTTOM && (
        <div className="absolute inset-x-0 bottom-0 h-2/5" style={{ backgroundColor: primaryColor }} />
      )}
      {style === TemplateStyle.TOP_STRIP && (
        <div className="absolute inset-x-0 top-0 h-2/5" style={{ backgroundColor: primaryColor }} />
      )}
      {style === TemplateStyle.CENTERED_OVERLAY && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 65%)' }}
        />
      )}
      {style === TemplateStyle.CENTERED_OVERLAY && (
        <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-white/80" />
      )}
      {style === TemplateStyle.BOLD_BOTTOM && (
        <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-white/80" />
      )}
      {style === TemplateStyle.TOP_STRIP && (
        <div className="absolute inset-x-1 top-1 h-1 rounded-full bg-white/80" />
      )}
    </div>
  )
}
