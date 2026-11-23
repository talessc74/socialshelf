import type { SelfieAssistantPort, SelfieChatTurn, SelfieAccountStatus } from '@socialshelf/domain'

export class AnswerSelfieQuestionUseCase {
  constructor(private readonly assistant: SelfieAssistantPort) {}

  async execute(
    question: string,
    history: SelfieChatTurn[],
    accountStatus: SelfieAccountStatus[],
    userId: string,
    brandId: string,
  ): Promise<string> {
    const trimmed = question.trim()
    if (!trimmed) {
      throw new Error('Question must not be empty')
    }

    return this.assistant.answer(trimmed, history, accountStatus, userId, brandId)
  }
}
