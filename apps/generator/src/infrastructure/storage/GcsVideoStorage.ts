import { Storage } from '@google-cloud/storage'
import type { VideoStoragePort } from '@socialshelf/domain'

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export class GcsVideoStorage implements VideoStoragePort {
  private readonly storage = new Storage()

  constructor(private readonly bucketName: string) {}

  async upload(
    userId: string,
    brandId: string,
    video: Buffer,
    mimeType: string,
    requestId: string,
  ): Promise<string> {
    const extension = EXTENSION_BY_MIME_TYPE[mimeType] ?? 'mp4'
    const path = `videos/${userId}/${brandId}/${requestId}-${Date.now()}.${extension}`
    await this.storage.bucket(this.bucketName).file(path).save(video, { contentType: mimeType })
    return path
  }

  async getSignedUrl(path: string, ttlSeconds: number): Promise<string> {
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(path)
      .getSignedUrl({ action: 'read', expires: Date.now() + ttlSeconds * 1000 })
    return url
  }

  async delete(path: string): Promise<void> {
    await this.storage.bucket(this.bucketName).file(path).delete()
  }
}
