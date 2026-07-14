import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Platform } from '@socialshelf/domain'
import ScheduledPostsPage from './page'
import { api, type ApiPost } from '../../../lib/api'
import { AssistantProvider, useSelfie } from '../../../contexts/AssistantContext'

const { pushMock, backMock } = vi.hoisted(() => ({ pushMock: vi.fn(), backMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}))

vi.mock('../../../lib/api', () => ({
  api: {
    getPosts: vi.fn(),
    getImageUrl: vi.fn(),
    updatePost: vi.fn(),
    publishPost: vi.fn(),
    deletePost: vi.fn(),
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
    videoStoragePath: null,
    status: 'scheduled',
    origin: 'manual',
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
      <AssistantProvider>
        <ScheduledPostsPage />
      </AssistantProvider>
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
        <ScheduledPostsPage />
      </AssistantProvider>
    </QueryClientProvider>,
  )
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

  it('narra o resumo do dia ao Selfie quando agendados e publicados carregam', async () => {
    const now = new Date()
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

    mockedApi.getPosts.mockImplementation((status) => {
      if (status === 'scheduled') return Promise.resolve([makePost({ status: 'scheduled', scheduledAt: inOneHour })])
      if (status === 'published') {
        return Promise.resolve([
          makePost({ id: 'p2', status: 'published', scheduledAt: null, publishedAt: now.toISOString() }),
        ])
      }
      return Promise.resolve([])
    })

    renderPageWithNarrationProbe()

    await waitFor(() => {
      expect(screen.getByTestId('selfie-narration')).toHaveTextContent('publicou 1 post')
    })
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('1 agendado')
  })

  it('não narra nada ao Selfie quando não há posts', async () => {
    mockedApi.getPosts.mockResolvedValue([])

    renderPageWithNarrationProbe()

    await screen.findByText(/Nenhum post agendado ainda/)
    expect(screen.getByTestId('selfie-narration')).toHaveTextContent('')
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

      expect(screen.getByRole('button', { name: 'Lista' })).toHaveClass('bg-accent')
      const card = screen.getByText('Texto agendado para o LinkedIn').closest('li')
      expect(card).toHaveClass('ring-2')
    })
  })

  describe('posts publicados', () => {
    function makePublishedPost(overrides: Partial<ApiPost> = {}): ApiPost {
      return makePost({
        id: 'post-2',
        status: 'published',
        scheduledAt: null,
        publishedAt: new Date('2026-06-20T15:00:00.000Z').toISOString(),
        content: [{ platform: Platform.INSTAGRAM, text: 'Texto já publicado no Instagram' }],
        ...overrides,
      })
    }

    function mockScheduledAndPublished(published: ApiPost[]) {
      mockedApi.getPosts.mockImplementation(async (status) => (status === 'published' ? published : []))
    }

    it('mostra os posts publicados numa seção própria, com badge e ação de repostar', async () => {
      mockScheduledAndPublished([makePublishedPost()])

      await renderListView()

      expect(await screen.findByText('Texto já publicado no Instagram')).toBeInTheDocument()
      expect(screen.getByText('Publicados')).toBeInTheDocument()
      expect(screen.getByText(/✓ Publicado/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Repostar' })).toBeInTheDocument()
    })

    it('ao clicar em Repostar, navega para o compose levando o post de origem', async () => {
      mockScheduledAndPublished([makePublishedPost()])

      const user = await renderListView()
      await screen.findByText('Texto já publicado no Instagram')

      await user.click(screen.getByRole('button', { name: 'Repostar' }))

      expect(pushMock).toHaveBeenCalledWith('/dashboard/compose?repostFrom=post-2')
    })

    it('mostra o selo "Automático" para post publicado pelo tick de autonomia', async () => {
      mockScheduledAndPublished([makePublishedPost({ origin: 'autonomy-tick' })])

      await renderListView()

      expect(await screen.findByText('🤖 Automático')).toBeInTheDocument()
    })

    it('não mostra o selo "Automático" para post publicado manualmente', async () => {
      mockScheduledAndPublished([makePublishedPost({ origin: 'manual' })])

      await renderListView()

      await screen.findByText('Texto já publicado no Instagram')
      expect(screen.queryByText('🤖 Automático')).not.toBeInTheDocument()
    })

    it('mostra o selo "Campanha" para post materializado de uma PhotoCampaign', async () => {
      mockScheduledAndPublished([makePublishedPost({ origin: 'campaign', campaignId: 'campaign-1' })])

      await renderListView()

      expect(await screen.findByText('📸 Campanha')).toBeInTheDocument()
    })

    it('abre o post completo ao clicar em "Ver post completo", com o texto na íntegra', async () => {
      mockScheduledAndPublished([
        makePublishedPost({ content: [{ platform: Platform.INSTAGRAM, text: 'Texto completo bem mais longo do que a prévia truncada mostraria' }] }),
      ])

      const user = await renderListView()
      await screen.findByText(/Texto completo bem mais longo/)

      await user.click(screen.getByRole('button', { name: 'Ver post completo' }))

      const dialog = await screen.findByRole('dialog', { name: 'Post completo' })
      expect(
        within(dialog).getByText('Texto completo bem mais longo do que a prévia truncada mostraria'),
      ).toBeInTheDocument()
    })

    it('fecha o post completo ao clicar em Fechar', async () => {
      mockScheduledAndPublished([makePublishedPost()])

      const user = await renderListView()
      await screen.findByText('Texto já publicado no Instagram')
      await user.click(screen.getByRole('button', { name: 'Ver post completo' }))
      await screen.findByRole('dialog', { name: 'Post completo' })

      await user.click(screen.getByRole('button', { name: 'Fechar ✕' }))

      expect(screen.queryByRole('dialog', { name: 'Post completo' })).not.toBeInTheDocument()
    })

    describe('no calendário', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-06-25T08:00:00.000Z'))
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('mostra o post publicado no dia certo, com indicador visual distinto do agendado', async () => {
        mockScheduledAndPublished([makePublishedPost()])

        renderPage()

        const entry = await screen.findByText(/Texto já publicado no Instagram/)
        expect(entry.closest('button')).toHaveClass('bg-emerald-50')
      })

      it('ao clicar no post publicado no calendário, volta para a lista e o destaca', async () => {
        const user = userEvent.setup()
        mockScheduledAndPublished([makePublishedPost()])

        renderPage()
        await screen.findByText(/Texto já publicado no Instagram/)

        await user.click(screen.getByText(/Texto já publicado no Instagram/))

        expect(screen.getByRole('button', { name: 'Lista' })).toHaveClass('bg-accent')
        const card = screen.getByText('Texto já publicado no Instagram').closest('li')
        expect(card).toHaveClass('ring-2')
      })
    })
  })

  describe('ordenação da lista', () => {
    function makeScheduledAt(iso: string, id: string, text: string): ApiPost {
      return makePost({ id, scheduledAt: iso, content: [{ platform: Platform.LINKEDIN, text }] })
    }

    function mockTwoScheduledPosts() {
      mockedApi.getPosts.mockImplementation(async (status) =>
        status === 'scheduled'
          ? [
              makeScheduledAt('2026-07-01T12:00:00.000Z', 'post-early', 'Post mais antigo'),
              makeScheduledAt('2026-07-05T12:00:00.000Z', 'post-late', 'Post mais recente'),
            ]
          : [],
      )
    }

    it('mostra o post mais recente primeiro por padrão', async () => {
      mockTwoScheduledPosts()

      await renderListView()
      await screen.findByText('Post mais recente')

      const texts = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
      expect(texts.findIndex((t) => t.includes('Post mais recente'))).toBeLessThan(
        texts.findIndex((t) => t.includes('Post mais antigo')),
      )
      expect(screen.getByRole('button', { name: '↓ Mais recentes primeiro' })).toBeInTheDocument()
    })

    it('permite inverter a ordem para mais antigos primeiro', async () => {
      mockTwoScheduledPosts()

      const user = await renderListView()
      await screen.findByText('Post mais recente')

      await user.click(screen.getByRole('button', { name: '↓ Mais recentes primeiro' }))

      const texts = screen.getAllByRole('listitem').map((li) => li.textContent ?? '')
      expect(texts.findIndex((t) => t.includes('Post mais antigo'))).toBeLessThan(
        texts.findIndex((t) => t.includes('Post mais recente')),
      )
      expect(screen.getByRole('button', { name: '↑ Mais antigos primeiro' })).toBeInTheDocument()
    })
  })

  describe('rascunhos aguardando aprovação', () => {
    function makeDraftPost(overrides: Partial<ApiPost> = {}): ApiPost {
      return makePost({
        id: 'draft-1',
        status: 'ai-draft',
        origin: 'autonomy-tick',
        scheduledAt: null,
        publishedAt: null,
        content: [{ platform: Platform.INSTAGRAM, text: 'Rascunho gerado automaticamente' }],
        ...overrides,
      })
    }

    function mockDrafts(drafts: ApiPost[]) {
      mockedApi.getPosts.mockImplementation(async (status) => (status === 'ai-draft' ? drafts : []))
    }

    it('mostra os rascunhos gerados pelo tick de autonomia (modo semi-automático), aguardando aprovação', async () => {
      mockDrafts([makeDraftPost()])

      await renderListView()

      expect(await screen.findByText('Rascunho gerado automaticamente')).toBeInTheDocument()
      expect(screen.getByText('🤖 Aguardando sua aprovação')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Aprovar e publicar agora' })).toBeInTheDocument()
    })

    it('não mostra rascunho de geração manual, mesmo com status ai-draft — só os do tick de autonomia', async () => {
      mockDrafts([makeDraftPost({ origin: 'manual' })])

      await renderListView()

      await screen.findByText(/Nenhum post agendado ainda/)
      expect(screen.queryByText('🤖 Aguardando sua aprovação')).not.toBeInTheDocument()
    })

    it('aprova e publica um rascunho automático imediatamente', async () => {
      mockDrafts([makeDraftPost()])
      mockedApi.publishPost.mockResolvedValue({ postId: 'draft-1', results: [], failedPlatforms: [] })

      const user = await renderListView()
      await screen.findByText('Rascunho gerado automaticamente')

      await user.click(screen.getByRole('button', { name: 'Aprovar e publicar agora' }))

      await waitFor(() => expect(mockedApi.publishPost).toHaveBeenCalledWith('draft-1'))
    })

    it('descarta um rascunho automático ao confirmar', async () => {
      mockDrafts([makeDraftPost()])
      mockedApi.deletePost.mockResolvedValue(undefined)
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const user = await renderListView()
      await screen.findByText('Rascunho gerado automaticamente')

      await user.click(screen.getByRole('button', { name: 'Descartar' }))

      expect(window.confirm).toHaveBeenCalledWith(
        'Tem certeza que deseja descartar este rascunho? Ele não será publicado.',
      )
      await waitFor(() => expect(mockedApi.deletePost).toHaveBeenCalledWith('draft-1'))
    })

    it('permite editar o texto de um rascunho sem definir data, mantendo aguardando aprovação', async () => {
      mockDrafts([makeDraftPost()])
      mockedApi.updatePost.mockResolvedValue(
        makeDraftPost({ content: [{ platform: Platform.INSTAGRAM, text: 'Texto revisado' }] }),
      )

      const user = await renderListView()
      await screen.findByText('Rascunho gerado automaticamente')

      await user.click(screen.getByRole('button', { name: 'Editar' }))
      const textarea = screen.getByDisplayValue('Rascunho gerado automaticamente')
      await user.clear(textarea)
      await user.type(textarea, 'Texto revisado')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      await waitFor(() => {
        expect(mockedApi.updatePost).toHaveBeenCalledWith(
          'draft-1',
          [{ platform: Platform.INSTAGRAM, text: 'Texto revisado' }],
          [],
          undefined,
        )
      })
    })

    it('permite agendar um rascunho pra uma data futura', async () => {
      mockDrafts([makeDraftPost()])
      mockedApi.updatePost.mockResolvedValue(
        makeDraftPost({ status: 'scheduled', scheduledAt: '2026-08-15T09:30:00.000Z' }),
      )

      const user = await renderListView()
      await screen.findByText('Rascunho gerado automaticamente')

      await user.click(screen.getByRole('button', { name: 'Editar' }))
      const dateInput = screen.getByLabelText('Data de publicação')
      await user.type(dateInput, '2026-08-15T09:30')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      await waitFor(() => {
        expect(mockedApi.updatePost).toHaveBeenCalledWith(
          'draft-1',
          [{ platform: Platform.INSTAGRAM, text: 'Rascunho gerado automaticamente' }],
          [],
          new Date('2026-08-15T09:30'),
        )
      })
    })
  })
})
