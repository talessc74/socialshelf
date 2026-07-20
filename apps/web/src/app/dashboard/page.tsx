'use client'

import { useViewMode } from '../../contexts/ViewModeContext'
import { ClassicHome } from './ClassicHome'
import { ShelfHome } from './ShelfHome'

/**
 * Seletor da home: decide entre o visual clássico e a nova prateleira a partir
 * da preferência viewMode (ver _local-bdr-policy-010 e lib/viewMode).
 *
 * O novo visual só aparece para quem pode alternar (Fase 0 = admin) e escolheu
 * 'shelf'. Enquanto não hidrata — e para todo usuário comum — cai na home
 * clássica, exatamente como hoje. As sub-rotas (/scheduled, /news, …) não
 * dependem disto e funcionam igual nos dois modos.
 */
export default function DashboardPage() {
  const { viewMode, canToggle, hydrated } = useViewMode()
  const showShelf = hydrated && canToggle && viewMode === 'shelf'
  return showShelf ? <ShelfHome /> : <ClassicHome />
}
