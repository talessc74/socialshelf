import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AutonomyTickHistory } from './AutonomyTickHistory'
import { api, type ApiAutonomyTickLogEntry } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getAutonomyTickLog: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makeEntry(overrides: Partial<ApiAutonomyTickLogEntry> = {}): ApiAutonomyTickLogEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    brandId: 'user-1',
    action: 'published',
    topicHeadline: 'Cliente relata resultado real',
    error: null,
    createdAt: '2026-07-11T15:00:00.000Z',
    ...overrides,
  }
}

function renderComponent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AutonomyTickHistory />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AutonomyTickHistory', () => {
  it('mostra mensagem de estado vazio quando ainda não há nenhuma tentativa registrada', async () => {
    mockedApi.getAutonomyTickLog.mockResolvedValue([])

    renderComponent()

    expect(await screen.findByText(/Nenhuma tentativa registrada ainda/)).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando a chamada falha', async () => {
    mockedApi.getAutonomyTickLog.mockRejectedValue(new Error('Falha de rede'))

    renderComponent()

    expect(await screen.findByText('Não foi possível carregar o histórico.')).toBeInTheDocument()
  })

  it('mostra o rótulo e a manchete da pauta para uma tentativa publicada com sucesso', async () => {
    mockedApi.getAutonomyTickLog.mockResolvedValue([makeEntry()])

    renderComponent()

    expect(await screen.findByText('Publicado com sucesso')).toBeInTheDocument()
    expect(screen.getByText('Cliente relata resultado real')).toBeInTheDocument()
  })

  it('mostra o motivo específico de cada tipo de skip', async () => {
    mockedApi.getAutonomyTickLog.mockResolvedValue([
      makeEntry({ id: 'e1', action: 'skipped-not-eligible', topicHeadline: 'Pauta fora do liberado' }),
      makeEntry({ id: 'e2', action: 'skipped-blocked', topicHeadline: 'Pauta bloqueada' }),
      makeEntry({ id: 'e3', action: 'skipped-no-suggestions', topicHeadline: null }),
    ])

    renderComponent()

    expect(await screen.findByText('Pulado — a pauta está fora dos tópicos liberados para automático')).toBeInTheDocument()
    expect(screen.getByText('Pulado — a pauta bateu num tópico bloqueado')).toBeInTheDocument()
    expect(screen.getByText('Pulado — nenhuma notícia/pauta disponível')).toBeInTheDocument()
  })

  it('mostra a mensagem de erro específica quando a ação é "error"', async () => {
    mockedApi.getAutonomyTickLog.mockResolvedValue([
      makeEntry({ action: 'error', topicHeadline: null, error: 'generation did not finish ready (status: failed)' }),
    ])

    renderComponent()

    expect(await screen.findByText('Erro ao gerar ou publicar')).toBeInTheDocument()
    expect(screen.getByText('generation did not finish ready (status: failed)')).toBeInTheDocument()
  })
})
