import { generateState } from '../../lib/csrf.js'
import { buildLinkedInAuthUrl } from '../../lib/linkedin-client.js'

export class GenerateLinkedInAuthUrlUseCase {
  execute(userId: string, brandId: string): { url: string; state: string } {
    const state = generateState(userId, brandId)
    const url = buildLinkedInAuthUrl(state)
    return { url, state }
  }
}
