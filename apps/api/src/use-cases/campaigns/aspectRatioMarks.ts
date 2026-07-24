import type { CampaignPhoto, CampaignPhotoRepository } from '@socialshelf/domain'

// Persiste o resultado de splitByAspectRatioSupport nas fotos: cada incompatível passa a ter
// unsupportedAspectRatio true, e toda foto considerada que não está mais incompatível volta a
// false. Grava só as que de fato mudaram, mesmo espírito de duplicateMarks.ts. Compartilhado por
// GenerateCampaignTimelineUseCase e ExtendCampaignTimelineUseCase.
export async function applyAspectRatioMarks(
  photoRepo: CampaignPhotoRepository,
  consideredPhotos: CampaignPhoto[],
  unsupported: CampaignPhoto[],
): Promise<void> {
  const unsupportedIds = new Set(unsupported.map((p) => p.id))
  const changed = consideredPhotos
    .filter((p) => unsupportedIds.has(p.id) !== p.unsupportedAspectRatio)
    .map((p) => ({ ...p, unsupportedAspectRatio: unsupportedIds.has(p.id) }))
  if (changed.length > 0) await photoRepo.saveAll(changed)
}
