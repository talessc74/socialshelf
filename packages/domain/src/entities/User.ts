export interface User {
  id: string
  email: string
  displayName: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AiConsent {
  granted: boolean
  grantedAt: Date
  version: string
}
