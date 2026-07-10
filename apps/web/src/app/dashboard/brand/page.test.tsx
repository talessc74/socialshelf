import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrandSettingsPage from './page'
import { api, type ApiBrandProfile } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getBrandProfile: vi.fn(),
    updateBrandProfile: vi.fn(),
    uploadImage: vi.fn(),
    uploadBrandDocument: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeBrandProfile(overrides: Partial<ApiBrandProfile> = {}): ApiBrandProfile {
  return {
    id: 'brand-1',
    userId: 'user-1',
    brandId: 'user-1',
    version: 1,
    business: { name: 'Minha Marca', segment: 'Tecnologia', description: '' },
    identity: { positioning: '', values: [] },
    visual: { primaryColor: '#000', secondaryColor: '#fff', typography: 'Inter', logoStoragePath: null },
    voice: { tone: '', allowedVocabulary: [], prohibitedVocabulary: [] },
    narrative: { recurringThemes: [] },
    operation: { autonomyLevel: 'manual', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 1 },
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BrandSettingsPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())
})

describe('BrandSettingsPage - guardrail de posts automáticos por dia', () => {
  it('não mostra o campo de limite diário enquanto o nível de autonomia é manual', async () => {
    renderPage()

    await screen.findByText('Manual')
    expect(screen.queryByLabelText('Máximo de posts automáticos por dia')).not.toBeInTheDocument()
  })

  it('mostra o campo assim que "Automático" é selecionado, e some ao voltar para manual', async () => {
    renderPage()

    fireEvent.click(await screen.findByText('Automático'))
    expect(await screen.findByLabelText('Máximo de posts automáticos por dia')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Manual'))
    await waitFor(() =>
      expect(screen.queryByLabelText('Máximo de posts automáticos por dia')).not.toBeInTheDocument(),
    )
  })

  it('sobe direto para o teto de 10 quando o usuário digita um valor maior', async () => {
    renderPage()

    fireEvent.click(await screen.findByText('Automático'))
    const input = await screen.findByLabelText('Máximo de posts automáticos por dia')
    fireEvent.change(input, { target: { value: '99' } })

    expect(input).toHaveValue(10)
  })

  it('envia maxAutoPostsPerDay ao salvar', async () => {
    mockedApi.updateBrandProfile.mockResolvedValue(makeBrandProfile({ operation: { autonomyLevel: 'automatic', autoPublishTopics: [], blockedTopics: [], maxAutoPostsPerDay: 3 } }))

    renderPage()

    fireEvent.click(await screen.findByText('Automático'))
    const input = await screen.findByLabelText('Máximo de posts automáticos por dia')
    fireEvent.change(input, { target: { value: '3' } })

    fireEvent.click(screen.getByText('Salvar marca'))

    await waitFor(() =>
      expect(mockedApi.updateBrandProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: expect.objectContaining({ autonomyLevel: 'automatic', maxAutoPostsPerDay: 3 }),
        }),
      ),
    )
  })
})
