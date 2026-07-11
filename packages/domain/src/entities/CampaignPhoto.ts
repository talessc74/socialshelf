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
}
