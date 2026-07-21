export interface CampaignPhoto {
  id: string
  userId: string
  brandId: string
  campaignId: string
  storagePath: string
  // Null quando a foto não tem EXIF de data (ex: screenshot, foto editada que perdeu
  // metadado) — nesse caso ela cai no cluster "sem localização" ordenada por upload.
  exifTakenAt: Date | null
  gpsLat: number | null
  gpsLng: number | null
  // Preenchido por GenerateCampaignTimelineUseCase ao clusterizar por proximidade GPS.
  locationClusterId: string | null
  createdAt: Date
  // Posição manual definida pelo usuário (arraste/mova na tela de upload). Null pra fotos
  // enviadas antes dessa feature existir — nesse caso a ordem cai de volta pra createdAt.
  order: number | null
  // dHash perceptual (16 hex = 64 bits) calculado no upload, usado pra detectar fotos
  // quase-iguais. Null quando não foi possível decodificar a imagem (formato exótico) ou pra
  // fotos enviadas antes dessa feature — nesse caso a foto nunca é tratada como duplicata.
  perceptualHash: string | null
  // Preenchido pela geração da linha do tempo: quando esta foto é quase-igual a outra do mesmo
  // grupo, aponta pro id da foto representante mantida no carrossel. Fotos representantes e
  // únicas ficam null. Uma foto com este campo preenchido fica FORA dos carrosséis e aparece no
  // "pool de extras" da tela de revisão, nunca é descartada em silêncio.
  duplicateOfPhotoId: string | null
}
