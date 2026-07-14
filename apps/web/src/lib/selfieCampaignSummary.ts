import type { ApiCampaignItem } from './api'

/**
 * Mensagem do Selfie para a tela de linha do tempo da campanha: soma de
 * fotos entre todos os itens — hoje só existe por item (badge "N fotos"),
 * nunca agregada.
 */
export function buildCampaignSummary(items: ApiCampaignItem[]): string | null {
  if (items.length === 0) return null

  const totalPhotos = items.reduce((sum, item) => sum + item.photoIds.length, 0)
  if (totalPhotos === 0) return null

  return `Suas ${totalPhotos} foto${totalPhotos > 1 ? 's' : ''} viraram ${items.length} post${items.length > 1 ? 's' : ''} nessa campanha!`
}
