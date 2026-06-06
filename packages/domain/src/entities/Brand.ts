import type { Platform } from './Platform.js'

export interface Brand {
  id: string
  userId: string
  name: string
  slug: string
  platforms: Platform[]
  createdAt: Date
  updatedAt: Date
}
