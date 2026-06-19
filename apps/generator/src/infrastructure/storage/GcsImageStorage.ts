import { Storage } from '@google-cloud/storage'
import type { ImageStoragePort } from '@socialshelf/domain'

export class GcsImageStorage implements ImageStoragePort {
  private readonly storage = new Storage()

  constructor(private readonly bucketName: string) {}

  async upload(
    userId: string,
    brandId: string,
    image: Buffer,
    mimeType: string,
    requestId: string,
  ): Promise<string> {
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const path = `${userId}/${brandId}/${requestId}-${Date.now()}.${extension}`
    await this.storage.bucket(this.bucketName).file(path).save(image, { contentType: mimeType })
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
