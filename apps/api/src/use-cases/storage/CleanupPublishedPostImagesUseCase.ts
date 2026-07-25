import type { PostRepository } from '@socialshelf/domain'
import { PUBLISHED_POST_IMAGE_RETENTION_DAYS } from '@socialshelf/domain'
import { fetchInternal } from '../../lib/serviceAuth.js'

export interface CleanupPublishedPostImagesResult {
  postsCleaned: number
  blobsDeleted: number
  blobsFailed: number
}

// _local-edr-policy-067: apaga as imagens de um post publicado N dias após publishedAt. O
// documento do Post continua existindo (é o histórico do que foi publicado) — só o blob em
// Cloud Storage some, e imagesDeletedAt marca que já aconteceu, pra tela de publicados mostrar
// um estado "imagem removida" em vez de tentar (e falhar) buscar uma signed URL. Falha em um
// blob não impede a marcação nem os próximos posts — reportado no resultado, não engolido.
export class CleanupPublishedPostImagesUseCase {
  constructor(
    private readonly postRepo: PostRepository,
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
    private readonly retentionDays: number = PUBLISHED_POST_IMAGE_RETENTION_DAYS,
  ) {}

  async execute(): Promise<CleanupPublishedPostImagesResult> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000)
    const posts = await this.postRepo.findPublishedForImageCleanup(cutoff)

    let blobsDeleted = 0
    let blobsFailed = 0

    for (const post of posts) {
      for (const path of post.imageStoragePaths) {
        try {
          await fetchInternal(`${this.generatorUrl}/images/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
            body: JSON.stringify({ path }),
          })
          blobsDeleted++
        } catch {
          blobsFailed++
        }
      }

      await this.postRepo.save({ ...post, imagesDeletedAt: new Date() })
    }

    return { postsCleaned: posts.length, blobsDeleted, blobsFailed }
  }
}
