import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import ScheduledPostsPage from './page'
import { api, type ApiPost } from '../../../lib/api'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getPosts: vi.fn(),
    getImageUrl: vi.fn(),
    updatePost: vi.fn(),
    publishPost: vi.fn(),
    uploadImage: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api, true)

function makePost(overrides: Partial<ApiPost> = {}): ApiPost {
  return {
    id: 'post-1',
    userId: 'user-1',
    brandId: 'user-1',
    brandProfileVersion: null,
    content: [{ platform: Platform.LINKEDIN, text: 'Texto agendado para o LinkedIn' }],
    imageStoragePaths: [],
    status: 'scheduled',
    externalIds: {},
    scheduledAt: new Date('2026-07-01T12:00:00.000Z').toISOString(),
    publishedAt: null,
    createdAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ScheduledPostsPage />
    </QueryClientProvider>,
  )
}

// A view padrão da página é o calendário — testes que exercitam o cartão de post em lista
// (editar, publicar agora, etc.) precisam alternar para a lista primeiro.
async function renderListView() {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Lista' }))
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ScheduledPostsPage', () => {
  it('mostra os posts agendados com data, plataforma e prévia do texto', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])

    await renderListView()

    expect(await screen.findByText('Texto agendado para o LinkedIn')).toBeInTheDocument()
    expect(screen.getByText('LinkedIn')).toBeInTheDocument()
    expect(mockedApi.getPosts).toHaveBeenCalledWith('scheduled')
  })

  it('mostra mensagem quando não há posts agendados', async () => {
    mockedApi.getPosts.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText(/Nenhum post agendado ainda/)).toBeInTheDocument()
  })

  it('mostra mensagem de erro quando a chamada falha', async () => {
    mockedApi.getPosts.mockRejectedValue(new Error('Falha de rede'))

    renderPage()

    expect(await screen.findByText(/Não foi possível carregar os posts agendados/)).toBeInTheDocument()
  })

  it('permite editar o texto de um post e salvar', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])
    mockedApi.updatePost.mockResolvedValue(makePost({ content: [{ platform: Platform.LINKEDIN, text: 'Texto revisado' }] }))

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const textarea = screen.getByDisplayValue('Texto agendado para o LinkedIn')
    await user.clear(textarea)
    await user.type(textarea, 'Texto revisado')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(mockedApi.updatePost).toHaveBeenCalledWith(
        'post-1',
        [{ platform: Platform.LINKEDIN, text: 'Texto revisado' }],
        [],
        new Date('2026-07-01T12:00:00.000Z'),
      )
    })
  })

  it('permite trocar a foto de um post ao editar', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost({ imageStoragePaths: ['old-photo.jpg'] })])
    mockedApi.getImageUrl.mockResolvedValue('https://example.com/old-photo.jpg')
    mockedApi.uploadImage.mockResolvedValue('new-photo.jpg')
    mockedApi.updatePost.mockResolvedValue(makePost({ imageStoragePaths: ['new-photo.jpg'] }))

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(await screen.findByRole('button', { name: 'Remover foto' }))

    const file = new File(['conteudo'], 'foto.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Adicionar foto'), file)
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(mockedApi.uploadImage).toHaveBeenCalledWith(file)
      expect(mockedApi.updatePost).toHaveBeenCalledWith(
        'post-1',
        [{ platform: Platform.LINKEDIN, text: 'Texto agendado para o LinkedIn' }],
        ['new-photo.jpg'],
        new Date('2026-07-01T12:00:00.000Z'),
      )
    })
  })

  it('permite alterar a data de publicação ao editar', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])
    mockedApi.updatePost.mockResolvedValue(makePost())

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dateInput = screen.getByLabelText('Data de publicação')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-08-15T09:30')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(mockedApi.updatePost).toHaveBeenCalledWith(
        'post-1',
        [{ platform: Platform.LINKEDIN, text: 'Texto agendado para o LinkedIn' }],
        [],
        new Date('2026-08-15T09:30'),
      )
    })
  })

  it('impede salvar quando a data de publicação está no passado', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dateInput = screen.getByLabelText('Data de publicação')
    await user.clear(dateInput)
    await user.type(dateInput, '2020-01-01T09:30')

    expect(screen.getByText('A data de publicação deve ser no futuro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('permite cancelar a edição sem salvar', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(mockedApi.updatePost).not.toHaveBeenCalled()
    expect(screen.getByText('Texto agendado para o LinkedIn')).toBeInTheDocument()
  })

  it('permite publicar um post agendado agora', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])
    mockedApi.publishPost.mockResolvedValue({
      postId: 'post-1',
      results: [{ platform: Platform.LINKEDIN, externalId: 'urn:li:ugcPost:1', publishedAt: new Date().toISOString() }],
      failedPlatforms: [],
    })

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Publicar agora' }))

    await waitFor(() => {
      expect(mockedApi.publishPost).toHaveBeenCalledWith('post-1')
    })
  })

  it('mostra erro quando a publicação imediata falha', async () => {
    mockedApi.getPosts.mockResolvedValue([makePost()])
    mockedApi.publishPost.mockRejectedValue(new Error('Publisher indisponível'))

    const user = await renderListView()
    await screen.findByText('Texto agendado para o LinkedIn')

    await user.click(screen.getByRole('button', { name: 'Publicar agora' }))

    expect(await screen.findByText('Publisher indisponível')).toBeInTheDocument()
  })

  describe('visão de calendário', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-07-01T08:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('mostra o post agendado no dia certo do mês exibido', async () => {
      mockedApi.getPosts.mockResolvedValue([makePost()])

      renderPage()

      expect(await screen.findByText('Julho de 2026')).toBeInTheDocument()
      expect(screen.getByText(/Texto agendado para o LinkedIn/)).toBeInTheDocument()
    })

    it('permite navegar entre os meses do calendário', async () => {
      const user = userEvent.setup()
      mockedApi.getPosts.mockResolvedValue([makePost()])

      renderPage()
      await screen.findByText(/Texto agendado para o LinkedIn/)

      await user.click(screen.getByRole('button', { name: 'Mês seguinte' }))
      expect(screen.getByText('Agosto de 2026')).toBeInTheDocument()
      expect(screen.queryByText(/Texto agendado para o LinkedIn/)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
      await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
      expect(screen.getByText('Junho de 2026')).toBeInTheDocument()
    })

    it('ao clicar em um post no calendário, volta para a lista e o destaca', async () => {
      const user = userEvent.setup()
      mockedApi.getPosts.mockResolvedValue([makePost()])

      renderPage()
      await screen.findByText(/Texto agendado para o LinkedIn/)

      await user.click(screen.getByText(/Texto agendado para o LinkedIn/))

      expect(screen.getByRole('button', { name: 'Lista' })).toHaveClass('bg-brand-600')
      const card = screen.getByText('Texto agendado para o LinkedIn').closest('li')
      expect(card).toHaveClass('ring-2')
    })
  })
})
