import { describe, it, expect, vi } from 'vitest'
import type { SelfieAssistantPort } from '@socialshelf/domain'
import { AnswerSelfieQuestionUseCase } from './AnswerSelfieQuestionUseCase.js'

function makeAssistant(answer = 'Vá em Central de Contas.'): SelfieAssistantPort {
  return { answer: vi.fn().mockResolvedValue(answer) }
}

describe('AnswerSelfieQuestionUseCase', () => {
  it('delegates the trimmed question to the assistant and returns its answer', async () => {
    const assistant = makeAssistant('Clique em Reconectar.')
    const useCase = new AnswerSelfieQuestionUseCase(assistant)

    const result = await useCase.execute('  Como reconecto o Instagram?  ', [], [], 'user-1', 'brand-1')

    expect(result).toBe('Clique em Reconectar.')
    expect(assistant.answer).toHaveBeenCalledWith('Como reconecto o Instagram?', [], [], 'user-1', 'brand-1')
  })

  it('throws when the question is empty after trimming', async () => {
    const assistant = makeAssistant()
    const useCase = new AnswerSelfieQuestionUseCase(assistant)

    await expect(useCase.execute('   ', [], [], 'user-1', 'brand-1')).rejects.toThrow(
      'Question must not be empty',
    )
    expect(assistant.answer).not.toHaveBeenCalled()
  })
})
