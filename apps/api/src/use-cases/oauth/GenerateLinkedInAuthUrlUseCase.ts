import { generateState } from '../../lib/csrf.js'
import { buildLinkedInAuthUrl } from '../../lib/linkedin-client.js'

export class GenerateLinkedInAuthUrlUseCase {
  execute(userId: string): { url: string; state: string } {
    const state = generateState(userId)
    const url = buildLinkedInAuthUrl(state)
    return { url, state }
  }
}
