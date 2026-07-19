import { generateState } from '../../lib/csrf.js'
import { buildInstagramAuthUrl } from '../../lib/instagram-client.js'

export class GenerateInstagramAuthUrlUseCase {
  execute(userId: string, brandId: string, webOrigin?: string): { url: string; state: string } {
    const state = generateState(userId, brandId, undefined, webOrigin)
    const url = buildInstagramAuthUrl(state)
    return { url, state }
  }
}
