import { generateState } from '../../lib/csrf.js'
import { buildLinkedInPageAuthUrl } from '../../lib/linkedin-page-client.js'

export class GenerateLinkedInPageAuthUrlUseCase {
  execute(userId: string, brandId: string, webOrigin?: string): { url: string; state: string } {
    const state = generateState(userId, brandId, undefined, webOrigin)
    const url = buildLinkedInPageAuthUrl(state)
    return { url, state }
  }
}
