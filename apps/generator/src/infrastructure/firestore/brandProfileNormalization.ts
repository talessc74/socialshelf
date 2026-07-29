import { ALL_TEMPLATE_STYLES } from '@socialshelf/domain'
import type { BrandProfileOperation } from '@socialshelf/domain'

// Perfis salvos antes de maxAutoPostsPerDay (_local-edr-policy-038) e stylePreferences (PR #148)
// existirem não têm esses campos no documento do Firestore — undefined sobrevive ao cast raw.
// Normaliza na leitura pra nunca devolver um operation incompleto pro gerador de copy ou pro
// tick de autonomia — mesmo normalizador usado em apps/api/FirestoreBrandProfileRepository.
export function normalizeBrandProfileOperation(raw: unknown): BrandProfileOperation {
  const data = (raw ?? {}) as Partial<BrandProfileOperation>

  const maxAutoPostsPerDay =
    typeof data.maxAutoPostsPerDay === 'number' && Number.isFinite(data.maxAutoPostsPerDay)
      ? Math.min(10, Math.max(1, Math.round(data.maxAutoPostsPerDay)))
      : 1

  const stylePreferences =
    Array.isArray(data.stylePreferences) && data.stylePreferences.length === ALL_TEMPLATE_STYLES.length
      ? data.stylePreferences
      : ALL_TEMPLATE_STYLES

  const dailyAiSpendingLimitBrl =
    typeof data.dailyAiSpendingLimitBrl === 'number' && Number.isFinite(data.dailyAiSpendingLimitBrl)
      ? data.dailyAiSpendingLimitBrl
      : null

  return {
    autonomyLevel: data.autonomyLevel ?? 'manual',
    autoPublishTopics: data.autoPublishTopics ?? [],
    blockedTopics: data.blockedTopics ?? [],
    maxAutoPostsPerDay,
    stylePreferences,
    dailyAiSpendingLimitBrl,
  }
}
