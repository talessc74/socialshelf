import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BrandSettingsPage from './page'
import { api, type ApiBrandProfile } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

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

// Holder mutável para controlar o retorno de useBrand por teste sem quebrar os demais
// (que rodam com activeBrand null → a seção de tipo de conta fica escondida).
const brandMock = vi.hoisted(() => ({
  current: { activeBrand: null as null | { id: string; name: string; slug: string; platforms: never[]; accountType: 'personal' | 'professional' }, setAccountType: vi.fn() },
}))
vi.mock('../../../contexts/BrandContext', () => ({ useBrand: () => brandMock.current }))

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
    operation: {
      autonomyLevel: 'manual',
      autoPublishTopics: [],
      blockedTopics: [],
      maxAutoPostsPerDay: 1,
      stylePreferences: [],
      dailyAiSpendingLimitBrl: null,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>
        <BrandSettingsPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

/** Sonda que expõe o texto narrado ao Selfie, para asserção nos testes. */
function SelfieNarrationProbe() {
  const { narration } = useSelfie()
  return <div data-testid="selfie-narration">{narration.active ? narration.message : ''}</div>
}

function renderPageWithNarrationProbe() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantProvider>
        <SelfieNarrationProbe />
        <BrandSettingsPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())
  brandMock.current = { activeBrand: null, setAccountType: vi.fn() }
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

  it('permite limpar e redigitar o valor sem travar em 1 ou 10, e clampa pro teto ao sair do campo', async () => {
    renderPage()

    fireEvent.click(await screen.findByText('Automático'))
    const input = await screen.findByLabelText('Máximo de posts automáticos por dia')

    // Limpar o campo pra digitar outro valor não pode travar em 1 (bug original).
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue(null)
    fireEvent.change(input, { target: { value: '5' } })
    expect(input).toHaveValue(5)

    // Valor acima do teto fica livre durante a digitação e só clampa ao sair do campo.
    fireEvent.change(input, { target: { value: '99' } })
    expect(input).toHaveValue(99)
    fireEvent.blur(input)
    expect(input).toHaveValue(10)
  })

  it('envia maxAutoPostsPerDay ao salvar', async () => {
    mockedApi.updateBrandProfile.mockResolvedValue(
      makeBrandProfile({
        operation: {
          autonomyLevel: 'automatic',
          autoPublishTopics: [],
          blockedTopics: [],
          maxAutoPostsPerDay: 3,
          stylePreferences: [],
          dailyAiSpendingLimitBrl: null,
        },
      }),
    )

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

describe('BrandSettingsPage - teto diário de gasto com IA', () => {
  it('mostra o campo em branco (sem limite) por padrão', async () => {
    renderPage()

    const input = await screen.findByLabelText('Teto diário de gasto com IA (R$)')
    expect(input).toHaveValue(null)
  })

  it('preenche o campo com o valor salvo do perfil', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(
      makeBrandProfile({
        operation: {
          autonomyLevel: 'manual',
          autoPublishTopics: [],
          blockedTopics: [],
          maxAutoPostsPerDay: 1,
          stylePreferences: [],
          dailyAiSpendingLimitBrl: 20,
        },
      }),
    )

    renderPage()

    const input = await screen.findByLabelText('Teto diário de gasto com IA (R$)')
    expect(input).toHaveValue(20)
  })

  it('envia dailyAiSpendingLimitBrl ao salvar, e null quando o campo é limpo', async () => {
    mockedApi.updateBrandProfile.mockResolvedValue(makeBrandProfile())

    renderPage()

    const input = await screen.findByLabelText('Teto diário de gasto com IA (R$)')
    fireEvent.change(input, { target: { value: '15' } })
    fireEvent.click(screen.getByText('Salvar marca'))

    await waitFor(() =>
      expect(mockedApi.updateBrandProfile).toHaveBeenCalledWith(
        expect.objectContaining({ operation: expect.objectContaining({ dailyAiSpendingLimitBrl: 15 }) }),
      ),
    )

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByText('Salvar marca'))

    await waitFor(() =>
      expect(mockedApi.updateBrandProfile).toHaveBeenCalledWith(
        expect.objectContaining({ operation: expect.objectContaining({ dailyAiSpendingLimitBrl: null }) }),
      ),
    )
  })
})

describe('BrandSettingsPage — switch de tipo de conta', () => {
  it('esconde a seção quando não há marca ativa', async () => {
    renderPage()
    await screen.findByText('Manual')
    expect(screen.queryByText('Tipo de conta')).not.toBeInTheDocument()
  })

  it('mostra o switch com o tipo atual e troca para pessoal ao clicar', async () => {
    const setAccountType = vi.fn().mockResolvedValue(undefined)
    brandMock.current = {
      activeBrand: { id: 'brand-1', name: 'Minha Marca', slug: 'default', platforms: [], accountType: 'professional' },
      setAccountType,
    }

    renderPage()

    const personal = await screen.findByRole('switch', { name: /Pessoal/ })
    const professional = screen.getByRole('switch', { name: /Profissional/ })
    expect(professional).toHaveAttribute('aria-checked', 'true')
    expect(personal).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(personal)
    await waitFor(() => expect(setAccountType).toHaveBeenCalledWith('brand-1', 'personal'))
  })
})

describe('BrandSettingsPage — narração do Selfie', () => {
  it('narra quantos campos-chave estão preenchidos quando o perfil carrega', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(makeBrandProfile())

    renderPageWithNarrationProbe()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('2/6')
    })
  })

  it('não narra nada quando ainda não existe BrandProfile', async () => {
    mockedApi.getBrandProfile.mockResolvedValue(null)

    renderPageWithNarrationProbe()

    await screen.findByText(/Você ainda não tem uma marca cadastrada/)
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('')
  })
})
