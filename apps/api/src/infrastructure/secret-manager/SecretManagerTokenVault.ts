import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import type { TokenVaultPort } from '@socialshelf/domain'

export class SecretManagerTokenVault implements TokenVaultPort {
  private client = new SecretManagerServiceClient()

  private get projectId(): string {
    const id = process.env['GCP_PROJECT_ID']
    if (!id) throw new Error('GCP_PROJECT_ID is required')
    return id
  }

  async store(ref: string, token: string): Promise<void> {
    const parent = `projects/${this.projectId}`
    const secretName = `${parent}/secrets/${ref}`

    try {
      await this.client.createSecret({
        parent,
        secretId: ref,
        secret: { replication: { automatic: {} } },
      })
    } catch {
      // Secret already exists — add a new version below
    }

    await this.client.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(token, 'utf8') },
    })
  }

  async retrieve(ref: string): Promise<string> {
    const name = `projects/${this.projectId}/secrets/${ref}/versions/latest`
    const [version] = await this.client.accessSecretVersion({ name })
    const payload = version.payload?.data
    if (!payload) throw new Error(`Secret ${ref} has no payload`)
    return Buffer.from(payload as Uint8Array).toString('utf8')
  }

  async delete(ref: string): Promise<void> {
    const name = `projects/${this.projectId}/secrets/${ref}`
    await this.client.deleteSecret({ name })
  }
}
