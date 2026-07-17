import type { Platform } from './Platform.js'

export interface OAuthConnection {
  id: string
  userId: string
  brandId: string
  platform: Platform
  pairwiseId: string
  tokenRef: string
  scopes: string[]
  organizationUrn?: string | null
  // Nome/@handle legível da conta ou Página conectada de fato (ex: "Escritório Fulano
  // Advocacia", "@marca.pessoal") — exibido na Central de Contas pra quem conectou dar
  // certeza de qual conta é essa, já que Facebook/Instagram podem estar ligados a
  // qualquer Página que o usuário administra, nem sempre a esperada (_local-edr-policy-053).
  accountLabel?: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}
