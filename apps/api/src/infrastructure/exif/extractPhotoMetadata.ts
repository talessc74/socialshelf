import exifr from 'exifr'

export interface PhotoMetadata {
  exifTakenAt: Date | null
  gpsLat: number | null
  gpsLng: number | null
}

// Fotos sem EXIF (screenshot, imagem editada que perdeu metadado) ou com o formato que o
// exifr não reconhece não devem derrubar o upload — só ficam sem localização/data, caindo
// no cluster "sem localização" do GenerateCampaignTimelineUseCase.
export async function extractPhotoMetadata(buffer: Buffer): Promise<PhotoMetadata> {
  try {
    const data = await exifr.parse(buffer, { gps: true, pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'] })
    if (!data) return { exifTakenAt: null, gpsLat: null, gpsLng: null }

    const takenAt = data['DateTimeOriginal'] ?? data['CreateDate']
    return {
      exifTakenAt: takenAt instanceof Date ? takenAt : null,
      gpsLat: typeof data['latitude'] === 'number' ? data['latitude'] : null,
      gpsLng: typeof data['longitude'] === 'number' ? data['longitude'] : null,
    }
  } catch {
    return { exifTakenAt: null, gpsLat: null, gpsLng: null }
  }
}
