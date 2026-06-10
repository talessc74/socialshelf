import { generateState } from '../../lib/csrf.js'
import { buildXAuthUrl, generatePkce } from '../../lib/x-client.js'

export interface XAuthUrlResult {
  url: string
  codeVerifier: string
  state: string
}

export class GenerateXAuthUrlUseCase {
  execute(userId: string): XAuthUrlResult {
    const state = generateState(userId)
    const { codeVerifier, codeChallenge } = generatePkce()
    const url = buildXAuthUrl(state, codeChallenge)
    return { url, codeVerifier, state }
  }
}
