import { test, expect } from '@playwright/experimental-ct-react'
import { BrandIdentityCard } from './BrandIdentityCard'
import type { ApiBrandProfile } from '../lib/api'

const longBrandProfile: ApiBrandProfile = {
  id: 'brand-1',
  userId: 'user-1',
  brandId: 'brand-1',
  version: 1,
  business: {
    name: 'Rádio Kactus Comunicação e Entretenimento Multiplataforma',
    segment: 'Rádio, streaming e produção de conteúdo musical independente',
    description: '',
  },
  identity: {
    positioning: 'A voz que conecta a cena musical independente ao público que quer descobrir o que vem antes de todo mundo saber',
    values: [],
  },
  visual: { primaryColor: '#c91577', secondaryColor: '#1a1a1a', typography: 'sans-serif', logoStoragePath: null },
  voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
  narrative: { recurringThemes: [] },
  operation: {
    autonomyLevel: 'manual',
    autoPublishTopics: [],
    blockedTopics: [],
    maxAutoPostsPerDay: 1,
    stylePreferences: [],
    dailyAiSpendingLimitBrl: null,
  },
  createdAt: new Date().toISOString(),
}

test('BrandIdentityCard mantém texto longo dentro do container, sem vazamento', async ({ mount }) => {
  const component = await mount(<BrandIdentityCard brandProfile={longBrandProfile} />)

  const overflowing = await component.evaluate((el) => {
    const cardRect = el.getBoundingClientRect()
    const descendants = el.querySelectorAll('*')
    return Array.from(descendants).some((node) => node.getBoundingClientRect().right > cardRect.right + 1)
  })

  expect(overflowing).toBe(false)
  await expect(component).toHaveScreenshot()
})
