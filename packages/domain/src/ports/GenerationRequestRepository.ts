import type { GenerationRequest, GenerationStatus } from '../entities/GenerationRequest.js'

export interface GenerationRequestRepository {
  save(request: GenerationRequest): Promise<void>
  findById(id: string): Promise<GenerationRequest | null>
  updateStatus(id: string, status: GenerationStatus, error?: string): Promise<void>
  updateOutputs(id: string, outputs: NonNullable<GenerationRequest['outputs']>): Promise<void>
  delete(id: string): Promise<void>
}
