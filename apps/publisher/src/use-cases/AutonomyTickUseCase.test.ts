import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AutonomyTickUseCase } from './AutonomyTickUseCase.js'
import { Platform } from '@socialshelf/domain'
import type {
  AutonomyBrandDiscoveryPort,
  AutonomyEligibleBrand,
  AutonomyDailyCounterRepository,
  AutonomyTickLogRepository,
  OAuthRepository,
  OAuthConnection,
  PostRepository,
  Post,
} from '@socialshelf/domain'
import type { PublishPostUseCase } from './PublishPostUseCase.js'
import type { GeneratorAutonomyClient } from '../infrastructure/generator/GeneratorAutonomyClient.js'

function makeBrand(overrides: Partial<AutonomyEligibleBrand> = {}): AutonomyEligibleBrand {
  return {
    userId: 'user-1',
    brandId: 'brand-1',
    autonomyLevel: 'semi-automatic',
    autoPublishTopics: [],
    blockedTopics: [],
    maxAutoPostsPerDay: 1,
    ...overrides,
  }
}

function makeConnection(platform: Platform): OAuthConnection {
  return {
    id: `conn-${platform}`,
    userId: 'user-1',
    brandId: 'brand-1',
    platform,
    pairwiseId: `pairwise-${platform}`,
    tokenRef: `token-ref-${platform}`,
    scopes: [],
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeDraftPost(id: string): Post {
  return {
    id,
    userId: 'user-1',
    brandId: 'brand-1',
    brandProfileVersion: 1,
    content: [{ platform: Platform.LINKEDIN, text: 'texto', charCount: 5 }],
    imageStoragePaths: ['path.png'],
    videoStoragePath: null,
    videoConsentAcceptedAt: null,
    status: 'ai-draft',
    origin: 'manual',
    campaignId: null,
    scheduledAt: null,
    publishedAt: null,
    externalIds: {},
    sourceArticleUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const suggestion = {
  id: 'topic-1',
  headline: 'Cliente relata resultado real',
  summary: 'Resumo',
  rationale: 'Case de sucesso',
}

describe('AutonomyTickUseCase', () => {
  let brandDiscovery: AutonomyBrandDiscoveryPort
  let dailyCounter: AutonomyDailyCounterRepository
  let oauthRepo: OAuthRepository
  let postRepo: PostRepository
  let publishPostUseCase: PublishPostUseCase
  let generatorClient: GeneratorAutonomyClient
  let tickLog: AutonomyTickLogRepository
  let useCase: AutonomyTickUseCase

  beforeEach(() => {
    // Meio-dia em Brasília (UTC-3) — dentro da janela comercial (9h-21h) usada por
    // computeDailySlotHours, então o gate de horário deixa passar por padrão em todo teste
    // que não mexe explicitamente em getCount/maxAutoPostsPerDay. Sem fixar o relógio, esses
    // testes ficariam dependentes da hora real de quando rodam (_local-edr-policy-038, adendo
    // 2026-07-11).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-11T15:00:00.000Z'))

    brandDiscovery = { findEligibleBrands: vi.fn().mockResolvedValue([makeBrand()]) }
    dailyCounter = {
      incrementIfUnderLimit: vi.fn().mockResolvedValue(true),
      getCount: vi.fn().mockResolvedValue(0),
    }
    oauthRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByPairwise: vi.fn(),
      findByBrandAndPlatform: vi.fn(),
      findByBrand: vi.fn().mockResolvedValue([makeConnection(Platform.LINKEDIN)]),
      delete: vi.fn(),
    }
    postRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdAndBrand: vi.fn(),
      findByBrand: vi.fn().mockResolvedValue([makeDraftPost('post-new')]),
      findScheduledBefore: vi.fn(),
      delete: vi.fn(),
      claimForPublishing: vi.fn(),
    }
    publishPostUseCase = {
      execute: vi.fn().mockResolvedValue({ postId: 'post-new', results: [], failedPlatforms: [] }),
    } as unknown as PublishPostUseCase
    generatorClient = {
      suggestTopics: vi.fn().mockResolvedValue([suggestion]),
      classifyAutonomy: vi.fn().mockResolvedValue({ blocked: false, autoPublishEligible: true }),
      generate: vi.fn().mockResolvedValue({ status: 'ready' }),
    }
    tickLog = { save: vi.fn().mockResolvedValue(undefined), findRecentByBrand: vi.fn().mockResolvedValue([]) }
    useCase = new AutonomyTickUseCase(
      brandDiscovery,
      dailyCounter,
      oauthRepo,
      postRepo,
      publishPostUseCase,
      generatorClient,
      tickLog,
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips a brand with no eligible target platforms (TikTok-only connection)', async () => {
    oauthRepo.findByBrand = vi.fn().mockResolvedValue([makeConnection(Platform.TIKTOK)])

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'skipped-no-platforms' })
    expect(generatorClient.suggestTopics).not.toHaveBeenCalled()
  })

  it('drops a connection with a platform value outside the enum instead of poisoning the whole generate request', async () => {
    // Achado real em produção: uma conexão órfã/legada guardava platform: "TWITTER" (fora do
    // enum, que só aceita 'twitter' minúsculo) — o schema de /generate valida targetPlatforms
    // como um array só, então essa entrada inválida derrubava a geração inteira com 400,
    // mesmo havendo Facebook/LinkedIn/Instagram válidos na mesma marca.
    oauthRepo.findByBrand = vi.fn().mockResolvedValue([
      makeConnection(Platform.FACEBOOK),
      { ...makeConnection(Platform.LINKEDIN), platform: 'TWITTER' as Platform },
    ])

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'draft-created' })
    expect(generatorClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({ targetPlatforms: [Platform.FACEBOOK] }),
    )
  })

  it('skips a brand with no topic suggestions', async () => {
    generatorClient.suggestTopics = vi.fn().mockResolvedValue([])

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'skipped-no-suggestions' })
    expect(generatorClient.classifyAutonomy).not.toHaveBeenCalled()
  })

  it('skips a blocked topic without generating anything', async () => {
    generatorClient.classifyAutonomy = vi.fn().mockResolvedValue({ blocked: true, autoPublishEligible: false })

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'skipped-blocked', topicHeadline: suggestion.headline })
    expect(generatorClient.generate).not.toHaveBeenCalled()
  })

  it('creates a draft (does not publish) in semi-automatic mode even when the topic would be auto-publish eligible', async () => {
    brandDiscovery.findEligibleBrands = vi.fn().mockResolvedValue([makeBrand({ autonomyLevel: 'semi-automatic' })])

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'draft-created', topicHeadline: suggestion.headline })
    expect(generatorClient.generate).toHaveBeenCalledTimes(1)
    expect(publishPostUseCase.execute).not.toHaveBeenCalled()
    // O contador diário passa a valer pros dois níveis de autonomia (não só automático) —
    // agora que o tick roda de hora em hora, sem isso semi-automático geraria um rascunho
    // novo a cada execução.
    expect(dailyCounter.incrementIfUnderLimit).toHaveBeenCalledWith('user-1', 'brand-1', expect.any(String), 1)
  })

  it('skips a brand without generating anything when the next slot of the day has not opened yet', async () => {
    dailyCounter.getCount = vi.fn().mockResolvedValue(1)

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'skipped-not-yet-time' })
    expect(dailyCounter.getCount).toHaveBeenCalledWith('user-1', 'brand-1', expect.any(String))
    expect(generatorClient.suggestTopics).not.toHaveBeenCalled()
    expect(generatorClient.generate).not.toHaveBeenCalled()
  })

  it('opens the second slot of the day for a brand configured with more than one post per day', async () => {
    brandDiscovery.findEligibleBrands = vi
      .fn()
      .mockResolvedValue([makeBrand({ autonomyLevel: 'automatic', maxAutoPostsPerDay: 2 })])
    // Já publicou o primeiro post do dia (slot das 9h) — o segundo slot (21h Brasília) só
    // abre perto do fim do dia.
    dailyCounter.getCount = vi.fn().mockResolvedValue(1)
    vi.setSystemTime(new Date('2026-07-12T00:00:00.000Z')) // 21h em Brasília (UTC-3)

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'published' })
    expect(generatorClient.suggestTopics).toHaveBeenCalledTimes(1)
  })

  it('skips generating anything in automatic mode when the topic is not auto-publish eligible', async () => {
    brandDiscovery.findEligibleBrands = vi.fn().mockResolvedValue([makeBrand({ autonomyLevel: 'automatic' })])
    generatorClient.classifyAutonomy = vi.fn().mockResolvedValue({ blocked: false, autoPublishEligible: false })

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'skipped-not-eligible' })
    expect(generatorClient.generate).not.toHaveBeenCalled()
  })

  it('generates and publishes in automatic mode when the topic is eligible and under the daily limit', async () => {
    brandDiscovery.findEligibleBrands = vi.fn().mockResolvedValue([makeBrand({ autonomyLevel: 'automatic' })])

    const [result] = await useCase.execute()

    expect(dailyCounter.incrementIfUnderLimit).toHaveBeenCalledWith('user-1', 'brand-1', expect.any(String), 1)
    expect(generatorClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({ brandId: 'brand-1', topicSuggestionId: 'topic-1', targetPlatforms: [Platform.LINKEDIN] }),
    )
    expect(postRepo.findByBrand).toHaveBeenCalledWith('user-1', 'brand-1', 'ai-draft')
    expect(publishPostUseCase.execute).toHaveBeenCalledWith('post-new', 'user-1', 'brand-1')
    expect(result).toMatchObject({ action: 'published', topicHeadline: suggestion.headline })
  })

  it('skips publishing (and does not call generate) once the daily limit is reached', async () => {
    brandDiscovery.findEligibleBrands = vi.fn().mockResolvedValue([makeBrand({ autonomyLevel: 'automatic' })])
    dailyCounter.incrementIfUnderLimit = vi.fn().mockResolvedValue(false)

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'skipped-daily-limit' })
    expect(generatorClient.generate).not.toHaveBeenCalled()
    expect(publishPostUseCase.execute).not.toHaveBeenCalled()
  })

  it('reports an error when generation does not finish ready', async () => {
    generatorClient.generate = vi.fn().mockResolvedValue({ status: 'failed' })

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'error' })
    expect(publishPostUseCase.execute).not.toHaveBeenCalled()
  })

  it('reports an error when generation succeeds but no ai-draft post can be found', async () => {
    postRepo.findByBrand = vi.fn().mockResolvedValue([])

    const [result] = await useCase.execute()

    expect(result).toMatchObject({ action: 'error', error: expect.stringContaining('no ai-draft post') })
  })

  it('isolates a per-brand failure so other brands still get processed', async () => {
    brandDiscovery.findEligibleBrands = vi.fn().mockResolvedValue([makeBrand({ brandId: 'brand-err' }), makeBrand({ brandId: 'brand-ok' })])
    oauthRepo.findByBrand = vi
      .fn()
      .mockRejectedValueOnce(new Error('firestore unavailable'))
      .mockResolvedValueOnce([makeConnection(Platform.LINKEDIN)])

    const results = await useCase.execute()

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ brandId: 'brand-err', action: 'error', error: 'firestore unavailable' })
    expect(results[1]).toMatchObject({ brandId: 'brand-ok', action: 'draft-created' })
  })

  it('deduplicates platforms and excludes TikTok when there are multiple connections', async () => {
    oauthRepo.findByBrand = vi
      .fn()
      .mockResolvedValue([makeConnection(Platform.LINKEDIN), makeConnection(Platform.INSTAGRAM), makeConnection(Platform.TIKTOK)])

    await useCase.execute()

    expect(generatorClient.generate).toHaveBeenCalledWith(
      expect.objectContaining({ targetPlatforms: [Platform.LINKEDIN, Platform.INSTAGRAM] }),
    )
  })

  describe('histórico do tick', () => {
    it('grava uma entrada de log para cada marca processada, com a mesma ação e motivo do resultado', async () => {
      brandDiscovery.findEligibleBrands = vi.fn().mockResolvedValue([makeBrand({ autonomyLevel: 'automatic' })])

      await useCase.execute()

      expect(tickLog.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          brandId: 'brand-1',
          action: 'published',
          topicHeadline: suggestion.headline,
          error: null,
        }),
      )
    })

    it('grava o motivo do skip mesmo quando nenhum tópico foi avaliado', async () => {
      dailyCounter.getCount = vi.fn().mockResolvedValue(1)

      await useCase.execute()

      expect(tickLog.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'skipped-not-yet-time', topicHeadline: null, error: null }),
      )
    })

    it('grava a mensagem de erro quando a marca falha antes de qualquer resultado normal', async () => {
      oauthRepo.findByBrand = vi.fn().mockRejectedValue(new Error('firestore unavailable'))

      await useCase.execute()

      expect(tickLog.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'error', error: 'firestore unavailable' }),
      )
    })

    it('não deixa uma falha ao gravar o log derrubar o tick nem o resultado devolvido', async () => {
      tickLog.save = vi.fn().mockRejectedValue(new Error('log write failed'))

      const [result] = await useCase.execute()

      expect(result).toMatchObject({ action: 'draft-created' })
    })
  })
})
