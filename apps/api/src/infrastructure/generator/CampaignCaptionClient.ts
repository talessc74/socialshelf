import { fetchInternal } from '../../lib/serviceAuth.js'

export interface CampaignCaptionRequest {
  userId: string
  brandId: string
  storagePath: string
  campaignName: string
  campaignDescription: string
  keywords: string[]
}

// Fronteira de infraestrutura com o generator-service (mesmo espírito de GeneratorAutonomyClient
// em apps/publisher) — não é uma porta de domínio, é específica de como os serviços deste
// deploy conversam entre si.
export interface CampaignCaptionClient {
  suggestCaption(input: CampaignCaptionRequest): Promise<{ caption: string }>
}

export class HttpCampaignCaptionClient implements CampaignCaptionClient {
  constructor(
    private readonly generatorUrl: string,
    private readonly internalSecret: string,
  ) {}

  async suggestCaption(input: CampaignCaptionRequest): Promise<{ caption: string }> {
    const res = await fetchInternal(`${this.generatorUrl}/campaigns/caption-suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': this.internalSecret },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(`Failed to suggest campaign caption: ${res.status} ${await res.text()}`)
    return (await res.json()) as { caption: string }
  }
}
