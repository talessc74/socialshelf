import { GoogleGenAI } from '@google/genai'

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
