import { generateState } from '../../lib/csrf.js'
import { buildMetaAuthUrl } from '../../lib/meta-client.js'

export class GenerateMetaAuthUrlUseCase {
  execute(userId: string, brandId: string, webOrigin?: string): { url: string; state: string } {
    const state = generateState(userId, brandId, undefined, webOrigin)
    const url = buildMetaAuthUrl(state)
    return { url, state }
  }
}
