import { GoogleGenAI, type GenerateContentResponseUsageMetadata } from '@google/genai'
import { estimateGeminiCostUsd } from '@socialshelf/domain'
import type { AiUsageRecorderPort } from '@socialshelf/domain'

// Cliente Gemini via Vertex AI (Gemini Enterprise Agent Platform), compartilhado por todas as
// classes deste diretório. `location: 'global'` precisa do baseUrl explícito — é o equivalente
// moderno do antigo `apiEndpoint` do SDK legado @google-cloud/vertexai.
export function createGeminiClient(projectId: string, location: string): GoogleGenAI {
  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location,
    ...(location === 'global' && { httpOptions: { baseUrl: 'https://aiplatform.googleapis.com' } }),
  })
}

// Registra o uso real (tokens devolvidos pela própria API) de uma chamada de texto/visão do
// Gemini — nunca lança: AiUsageRecorderPort.record() já é fire-and-forget por contrato, mas o
// `void` aqui também documenta que o chamador não deve `await` isto no caminho crítico.
export function recordGeminiUsage(
  usageRecorder: AiUsageRecorderPort,
  params: { userId: string; brandId: string; operation: string; model: string },
  usage: GenerateContentResponseUsageMetadata | undefined,
): void {
  void usageRecorder.record({
    userId: params.userId,
    brandId: params.brandId,
    category: 'text-generation',
    operation: params.operation,
    model: params.model,
    promptTokenCount: usage?.promptTokenCount,
    candidatesTokenCount: usage?.candidatesTokenCount,
    thoughtsTokenCount: usage?.thoughtsTokenCount,
    estimatedCostUsd: estimateGeminiCostUsd({
      promptTokenCount: usage?.promptTokenCount,
      candidatesTokenCount: usage?.candidatesTokenCount,
      thoughtsTokenCount: usage?.thoughtsTokenCount,
    }),
  })
}
