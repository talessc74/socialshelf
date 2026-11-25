import type { FirestoreMetaTesterChecklistRepository } from '../../infrastructure/firestore/FirestoreMetaTesterChecklistRepository.js'

export class MarkSignupHandledUseCase {
  constructor(private readonly checklistRepo: FirestoreMetaTesterChecklistRepository) {}

  async execute(userId: string, handled: boolean): Promise<void> {
    await this.checklistRepo.setHandled(userId, handled)
  }
}
