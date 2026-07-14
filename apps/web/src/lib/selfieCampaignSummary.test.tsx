import { describe, it, expect } from 'vitest'
import { buildCampaignSummary } from './selfieCampaignSummary'
import type { ApiCampaignItem } from './api'

function makeItem(overrides: Partial<ApiCampaignItem> = {}): ApiCampaignItem {
  return {
    id: 'item-1',
    campaignId: 'campaign-1',
    order: 0,
    photoIds: ['p1'],
    caption: 'Legenda',
    scheduledAt: new Date().toISOString(),
    status: 'planned',
    postId: null,
    ...overrides,
  }
}

describe('buildCampaignSummary', () => {
  it('retorna null sem itens', () => {
    expect(buildCampaignSummary([])).toBeNull()
  })

  it('soma fotos de todos os itens e conta os posts', () => {
    const items = [
      makeItem({ id: 'i1', photoIds: ['p1', 'p2'] }),
      makeItem({ id: 'i2', photoIds: ['p3'] }),
      makeItem({ id: 'i3', photoIds: ['p4', 'p5', 'p6'] }),
    ]
    const message = buildCampaignSummary(items)
    expect(message).toContain('6 fotos')
    expect(message).toContain('3 posts')
  })

  it('retorna null se nenhum item tiver foto', () => {
    const items = [makeItem({ photoIds: [] })]
    expect(buildCampaignSummary(items)).toBeNull()
  })
})
