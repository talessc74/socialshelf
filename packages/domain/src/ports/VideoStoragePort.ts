export interface VideoStoragePort {
  upload(
    userId: string,
    brandId: string,
    video: Buffer,
    mimeType: string,
    requestId: string,
  ): Promise<string>
  getSignedUrl(path: string, ttlSeconds: number, downloadFilename?: string): Promise<string>
  delete(path: string): Promise<void>
  listOlderThan(maxAgeMs: number): Promise<string[]>
}
