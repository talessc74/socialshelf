/**
 * As 7 seções da nova entrada /dashboard — fonte única para a prateleira 3D
 * (desktop) e o flip clock (mobile). Cada seção é uma porta para a rota real
 * que já existe hoje; a metáfora visual não recria a funcionalidade, só leva
 * até ela (ver _local-bdr-policy-010, seção redesign, e o De-Para da migração).
 *
 * Ordem = ordem na prateleira: linha 1 (Agenda·Notícias·Desempenho·Criar),
 * linha 2 (Campanhas·Marca·Redes).
 */

export type ShelfSectionId =
  | 'agenda'
  | 'noticias'
  | 'desempenho'
  | 'criar'
  | 'campanhas'
  | 'marca'
  | 'redes'

export interface ShelfSection {
  id: ShelfSectionId
  /** Legenda em caixa alta, sob o livro (desktop). */
  label: string
  /** Nome do card/visor e do header da tela (mobile). */
  name: string
  /** Rota real para onde a capa/seção leva. */
  route: string
  /** Cor de destaque da capa (desktop). */
  accent: string
  /** Cor da contra-capa/lombada (desktop). */
  colorDark: string
  /** Cor de destaque do card/detalhe (mobile). */
  accentMobile: string
  /** Largura da capa em px (desktop). */
  width: number
  /** Ícone do card (mobile) — placeholder emoji até virar ícone do design system. */
  icon: string
}

export const SHELF_SECTIONS: ShelfSection[] = [
  { id: 'agenda',     label: 'AGENDA',     name: 'Agenda',     route: '/dashboard/scheduled',   accent: '#c9a84c', colorDark: '#6e5a1f', accentMobile: '#c9a84c', width: 112, icon: '📅' },
  { id: 'noticias',   label: 'NOTÍCIAS',   name: 'Notícias',   route: '/dashboard/news',        accent: '#6b4010', colorDark: '#3d2409', accentMobile: '#e0b070', width: 124, icon: '📰' },
  { id: 'desempenho', label: 'DESEMPENHO', name: 'Desempenho', route: '/dashboard/performance', accent: '#e07850', colorDark: '#7a3d28', accentMobile: '#e07850', width: 113, icon: '📊' },
  { id: 'criar',      label: 'CRIAR',      name: 'Criar',      route: '/dashboard/generate',    accent: '#2850c8', colorDark: '#16296b', accentMobile: '#5b9bd5', width: 124, icon: '✨' },
  { id: 'campanhas',  label: 'CAMPANHAS',  name: 'Campanhas',  route: '/dashboard/campaigns',   accent: '#4a4a46', colorDark: '#2a2a28', accentMobile: '#7a756a', width: 120, icon: '📸' },
  { id: 'marca',      label: 'MARCA',      name: 'Marca',      route: '/dashboard/brand',       accent: '#1a1a1a', colorDark: '#0a0a0a', accentMobile: '#b98acb', width: 110, icon: '🏷️' },
  { id: 'redes',      label: 'REDES',      name: 'Redes',      route: '/dashboard/accounts',    accent: '#0077b5', colorDark: '#004469', accentMobile: '#6bbf8a', width: 130, icon: '🔗' },
]

/** Distribuição em duas prateleiras flutuantes (desktop). */
export const SHELF_ROW_1: ShelfSectionId[] = ['agenda', 'noticias', 'desempenho', 'criar']
export const SHELF_ROW_2: ShelfSectionId[] = ['campanhas', 'marca', 'redes']
