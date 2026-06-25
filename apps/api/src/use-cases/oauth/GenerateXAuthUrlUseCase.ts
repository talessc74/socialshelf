import { generateState } from '../../lib/csrf.js'
import { buildXAuthUrl, generatePkce } from '../../lib/x-client.js'

export interface XAuthUrlResult {
  url: string
  state: string
}

export class GenerateXAuthUrlUseCase {
  execute(userId: string, brandId: string): XAuthUrlResult {
    const { codeVerifier, codeChallenge } = generatePkce()
    const state = generateState(userId, brandId, codeVerifier)
    const url = buildXAuthUrl(state, codeChallenge)
    return { url, state }
  }
}
