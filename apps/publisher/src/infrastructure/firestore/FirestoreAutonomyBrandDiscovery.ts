import { db } from '../firebase-admin.js'
import { TemplateStyle } from '@socialshelf/domain'
import type { AutonomyBrandDiscoveryPort, AutonomyEligibleBrand, BrandProfileOperation } from '@socialshelf/domain'

// Ordem que reproduz o comportamento hardcoded de antes desta feature (sempre "Faixa
// inferior") pra qualquer BrandProfile salvo antes do campo existir — sem migração de dado,
// só um default de leitura.
const DEFAULT_STYLE_PREFERENCES: TemplateStyle[] = [
  TemplateStyle.BOLD_BOTTOM,
  TemplateStyle.CENTERED_OVERLAY,
  TemplateStyle.TOP_STRIP,
  TemplateStyle.NO_TEXT,
]

// Único lugar do sistema hoje que precisa descobrir marcas através de todos os usuários —
// BrandProfileRepository (api, generator) sempre opera com userId/brandId já conhecidos.
// Perfis de marca são versionados e imutáveis (_local-adr-policy-025); esta consulta varre
// todas as versões via collectionGroup e reduz em memória para a versão mais recente por
// marca, já que o Firestore não agrupa (GROUP BY) nativamente numa collectionGroup query.
// Custo conhecido: cresce com o total de versões já salvas, não só com o número de marcas —
// aceitável para um tick diário no volume atual; revisitar se isso virar gargalo real.
export class FirestoreAutonomyBrandDiscovery implements AutonomyBrandDiscoveryPort {
  async findEligibleBrands(): Promise<AutonomyEligibleBrand[]> {
    const snapshot = await db.collectionGroup('brand_profiles').get()

    const latestByBrand = new Map<string, { version: number; operation: BrandProfileOperation }>()
    for (const doc of snapshot.docs) {
      // Caminho: users/{userId}/brands/{brandId}/brand_profiles/v{version}
      const parts = doc.ref.path.split('/')
      const userId = parts[1]
      const brandId = parts[3]
      if (!userId || !brandId) continue

      const data = doc.data()
      const version = data['version'] as number
      const operation = data['operation'] as BrandProfileOperation | undefined
      if (!operation) continue

      const key = `${userId}/${brandId}`
      const existing = latestByBrand.get(key)
      if (!existing || version > existing.version) {
        latestByBrand.set(key, { version, operation })
      }
    }

    const eligible: AutonomyEligibleBrand[] = []
    for (const [key, { operation }] of latestByBrand) {
      if (operation.autonomyLevel === 'manual') continue
      const [userId, brandId] = key.split('/')
      eligible.push({
        userId: userId!,
        brandId: brandId!,
        autonomyLevel: operation.autonomyLevel,
        autoPublishTopics: operation.autoPublishTopics,
        blockedTopics: operation.blockedTopics,
        maxAutoPostsPerDay: operation.maxAutoPostsPerDay,
        stylePreferences:
          operation.stylePreferences && operation.stylePreferences.length > 0
            ? operation.stylePreferences
            : DEFAULT_STYLE_PREFERENCES,
      })
    }
    return eligible
  }
}
