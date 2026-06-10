import { createHash } from 'crypto'
import type { Platform } from '../entities/Platform.js'

export function derivePairwiseId(userId: string, platform: Platform): string {
  return createHash('sha256')
    .update(`${userId}:${platform}`)
    .digest('hex')
    .slice(0, 32)
}
