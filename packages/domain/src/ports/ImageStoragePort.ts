export interface ImageStoragePort {
  upload(
    userId: string,
    brandId: string,
    image: Buffer,
    mimeType: string,
    requestId: string,
  ): Promise<string>
  getSignedUrl(path: string, ttlSeconds: number): Promise<string>
  delete(path: string): Promise<void>
}
