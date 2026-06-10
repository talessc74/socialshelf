import { generateState } from '../../lib/csrf.js'
import { buildMetaAuthUrl } from '../../lib/meta-client.js'

export class GenerateMetaAuthUrlUseCase {
  execute(userId: string): { url: string; state: string } {
    const state = generateState(userId)
    const url = buildMetaAuthUrl(state)
    return { url, state }
  }
}
