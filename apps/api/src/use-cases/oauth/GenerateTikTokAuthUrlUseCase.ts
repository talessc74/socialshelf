import { generateState } from '../../lib/csrf.js'
import { buildTikTokAuthUrl, generatePkce } from '../../lib/tiktok-client.js'

export interface TikTokAuthUrlResult {
  url: string
  state: string
}

export class GenerateTikTokAuthUrlUseCase {
  execute(userId: string, brandId: string): TikTokAuthUrlResult {
    const { codeVerifier, codeChallenge } = generatePkce()
    const state = generateState(userId, brandId, codeVerifier)
    const url = buildTikTokAuthUrl(state, codeChallenge)
    return { url, state }
  }
}
