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
  // Razão largura/altura calculada no upload (ex: 2.1 para uma foto bem panorâmica). Null quando
  // o sharp não conseguiu decodificar as dimensões (formato exótico) — nesse caso a foto nunca é
  // tratada como incompatível com nenhuma rede.
  aspectRatio: number | null
  // Preenchido pela geração da linha do tempo (só quando a campanha inclui Instagram): true
  // quando aspectRatio cai fora do intervalo 4:5–1.91:1 que a Graph API aceita pra publicar. Uma
  // foto assim fica FORA dos carrosséis e aparece no "pool de fora" da tela de revisão — mesma
  // filosofia do duplicateOfPhotoId, nunca é descartada em silêncio.
  unsupportedAspectRatio: boolean
}
