import type { Post } from '@socialshelf/domain'
import { Platform } from '@socialshelf/domain'

// Alguns Posts gravados antes de _local-edr-policy-074 têm content[].text como array de
// parágrafos em vez de string (bug do GeminiCopyGenerator, já corrigido na origem) — normaliza
// na leitura em vez de propagar o formato quebrado, mesma filosofia de tolerância já usada em
// _local-edr-policy-032/074, para que posts antigos voltem a funcionar sem precisar de uma
// migração de dados. charCount é sempre recalculado a partir do texto final.
export function normalizePostContent(raw: unknown): Post['content'] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const entry = item as { platform: Platform; text: unknown }
    const text =
      typeof entry.text === 'string'
        ? entry.text
        : Array.isArray(entry.text) && entry.text.every((p) => typeof p === 'string')
          ? entry.text.join('\n\n')
          : ''
    return { platform: entry.platform, text, charCount: text.length }
  })
}
