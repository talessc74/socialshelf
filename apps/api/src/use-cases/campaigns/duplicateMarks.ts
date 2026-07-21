import type { CampaignPhoto, CampaignPhotoRepository } from '@socialshelf/domain'

// Persiste o resultado do colapso de quase-iguais nas fotos: cada extra passa a apontar pro id
// do seu representante (duplicateOfPhotoId), e toda foto considerada que não é extra volta a null.
// Grava só as que de fato mudaram, pra não reescrever a coleção inteira a cada regeneração da
// linha do tempo. Compartilhado por GenerateCampaignTimelineUseCase e ExtendCampaignTimelineUseCase.
export async function applyDuplicateMarks(
  photoRepo: CampaignPhotoRepository,
  consideredPhotos: CampaignPhoto[],
  extras: Array<{ photo: CampaignPhoto; representativeId: string }>,
): Promise<void> {
  const extraMap = new Map(extras.map((e) => [e.photo.id, e.representativeId]))
  const changed = consideredPhotos
    .filter((p) => (extraMap.get(p.id) ?? null) !== p.duplicateOfPhotoId)
    .map((p) => ({ ...p, duplicateOfPhotoId: extraMap.get(p.id) ?? null }))
  if (changed.length > 0) await photoRepo.saveAll(changed)
}
