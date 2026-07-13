export enum TemplateStyle {
  BOLD_BOTTOM = 'bold-bottom',
  CENTERED_OVERLAY = 'centered-overlay',
  TOP_STRIP = 'top-strip',
  NO_TEXT = 'no-text',
}

export const ALL_TEMPLATE_STYLES = Object.values(TemplateStyle)

// Rótulo em pt-BR compartilhado entre a UI de preferência de estilo (apps/web) e o prompt
// que pede pra IA escolher um estilo dentro da ordem de preferência da marca (apps/generator)
// — mesmo texto nos dois lugares, sem duplicar a tradução.
export const TEMPLATE_STYLE_LABELS: Record<TemplateStyle, string> = {
  [TemplateStyle.BOLD_BOTTOM]: 'Faixa inferior',
  [TemplateStyle.CENTERED_OVERLAY]: 'Overlay escuro',
  [TemplateStyle.TOP_STRIP]: 'Faixa superior',
  [TemplateStyle.NO_TEXT]: 'Sem texto',
}
