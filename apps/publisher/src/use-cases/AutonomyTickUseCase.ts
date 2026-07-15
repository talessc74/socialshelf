import { randomUUID } from 'crypto'
import { ALL_PLATFORMS, Platform, computeDailySlotHours } from '@socialshelf/domain'
import type {
  AutonomyBrandDiscoveryPort,
  AutonomyEligibleBrand,
  AutonomyDailyCounterRepository,
  AutonomyTickAction,
  AutonomyTickLogRepository,
  OAuthRepository,
  PostRepository,
} from '@socialshelf/domain'
import type { PublishPostUseCase } from './PublishPostUseCase.js'
import type {
  GeneratorAutonomyClient,
  AutonomyTopicSuggestion,
  AutonomyClassification,
} from '../infrastructure/generator/GeneratorAutonomyClient.js'

// Teto de quantas sugestões (da mais relevante pra baixo) o tick tenta classificar num único
// tick antes de desistir e pular por "bloqueada" — bounded pra não virar 1 chamada de
// classificação por sugestão sem limite nenhum quando o topo do ranking está cheio de tópicos
// bloqueados.
const MAX_TOPIC_CANDIDATES_PER_TICK = 5

export interface AutonomyTickBrandResult {
  userId: string
  brandId: string
  action: AutonomyTickAction
  topicHeadline?: string
  error?: string
}

// Mesma janela comercial fixa (9h-21h Brasília) usada pra espaçar os posts de uma campanha —
// computeDailySlotHours(maxAutoPostsPerDay) devolve os horários igualmente espaçados do dia
// (ex: [9, 15, 21] para 3 posts/dia). "Slots abertos até agora" é quantos desses horários já
// passaram — o tick (agora de hora em hora, não mais 1x/dia) só deixa a marca gerar mais um
// post quando o número já publicado hoje for menor que os slots já abertos.
function brasiliaHourNow(now: Date): number {
  // hourCycle: 'h23', não hour12: false — achado real em produção (Node 20/ICU): com
  // locale 'en-US' + hour12: false, formatToParts devolve hour="24" pra meia-noite em vez
  // de "00" (bug de ICU conhecido, não reproduz com 'pt-BR' nem em Node mais recente). Isso
  // fazia brasiliaHourNow() devolver ~24h logo no primeiro tick do dia — todos os slots do
  // dia apareciam "abertos" às 00h, deixando a marca publicar um post de madrugada e gastando
  // uma vaga do dia antes do horário comercial sequer começar.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return hour + minute / 60
}

function slotsOpenByNow(postsPerDay: number, now: Date): number {
  const nowHour = brasiliaHourNow(now)
  return computeDailySlotHours(postsPerDay).filter((slotHour) => slotHour <= nowHour).length
}

// A chave do contador diário tem que usar o mesmo calendário do gate de horário acima
// (Brasília), não o calendário UTC — achado real em produção: entre 21h-24h de Brasília
// (0h-3h UTC do dia seguinte), o gate já considera todos os slots do dia "abertos" (é fim
// de tarde/noite em Brasília), mas `new Date().toISOString().slice(0, 10)` já tinha virado
// pra data UTC do dia seguinte. O contador desse dia seguinte saturava (maxAutoPostsPerDay)
// ainda de madrugada, antes do horário comercial de Brasília daquele dia sequer começar —
// bloqueando a marca o dia inteiro com "skipped-not-yet-time"/limite diário.
function brasiliaDateNow(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

// Fase 4 do roadmap (_local-bdr-plan-002): ativa o dial de autonomia com os guardrails
// exigidos como pré-condição — teto diário configurável por marca (não um ajuste
// posterior), classificação semântica de bloqueio antes de qualquer rascunho, e modo
// automático restrito aos tópicos explicitamente liberados. "Manual" nunca chega aqui:
// findEligibleBrands() já filtra por autonomyLevel — trocar o dial de volta para manual
// entre um tick e o próximo já corta a automação, sem precisar de um botão de emergência
// separado.
//
// O tick roda de hora em hora (não mais 1x/dia — _local-edr-policy-038, adendo 2026-07-11)
// pra que maxAutoPostsPerDay > 1 vire realidade: o gate de horário (slotsOpenByNow) decide se
// já é hora do próximo post do dia antes de gastar qualquer chamada de sugestão/classificação,
// e o contador diário passa a valer pros dois níveis de autonomia — antes só o automático
// consultava o contador; sem esse gate, semi-automático geraria um rascunho novo a cada hora.
export class AutonomyTickUseCase {
  constructor(
    private readonly brandDiscovery: AutonomyBrandDiscoveryPort,
    private readonly dailyCounter: AutonomyDailyCounterRepository,
    private readonly oauthRepo: OAuthRepository,
    private readonly postRepo: PostRepository,
    private readonly publishPostUseCase: PublishPostUseCase,
    private readonly generatorClient: GeneratorAutonomyClient,
    private readonly tickLog: AutonomyTickLogRepository,
  ) {}

  async execute(): Promise<AutonomyTickBrandResult[]> {
    const brands = await this.brandDiscovery.findEligibleBrands()
    const results: AutonomyTickBrandResult[] = []
    for (const brand of brands) {
      let result: AutonomyTickBrandResult
      try {
        result = await this.processBrand(brand)
      } catch (err) {
        result = {
          userId: brand.userId,
          brandId: brand.brandId,
          action: 'error',
          error: err instanceof Error ? err.message : String(err),
        }
      }
      results.push(result)
      // Histórico consultável (_local-edr-policy-038, adendo 2026-07-11) — sem isso o
      // resultado desaparece junto com a resposta HTTP que só o Cloud Scheduler vê. Falha ao
      // gravar não deve derrubar o tick nem as marcas seguintes: é observabilidade, não a
      // função principal.
      try {
        await this.tickLog.save({
          id: randomUUID(),
          userId: result.userId,
          brandId: result.brandId,
          action: result.action,
          topicHeadline: result.topicHeadline ?? null,
          error: result.error ?? null,
          createdAt: new Date(),
        })
      } catch {
        // observabilidade — não propaga
      }
    }
    return results
  }

  private async processBrand(brand: AutonomyEligibleBrand): Promise<AutonomyTickBrandResult> {
    const base = { userId: brand.userId, brandId: brand.brandId }

    // TikTok fica fora do alvo automático: exige vídeo, e este pipeline só compõe post de
    // imagem/texto — mesma exclusão já aplicada em "publicar também em" na tela de resultado.
    const connections = await this.oauthRepo.findByBrand(brand.userId, brand.brandId)
    // Nunca confiar cegamente no valor de `platform` salvo em oauth_connections: uma conexão
    // órfã/legada com um valor fora do enum (ex: "TWITTER" maiúsculo, achado em produção)
    // faz o schema de /generate rejeitar o array inteiro com 400, não só a plataforma
    // inválida — derrubando a geração pras plataformas válidas também.
    const targetPlatforms = [...new Set(connections.map((c) => c.platform))].filter(
      (p) => p !== Platform.TIKTOK && ALL_PLATFORMS.includes(p),
    )
    if (targetPlatforms.length === 0) return { ...base, action: 'skipped-no-platforms' }

    const now = new Date()
    // Prefixo "br-" evita colidir com os documentos antigos, escritos antes desta correção,
    // cuja chave era a mesma string de data mas calculada em UTC — sem o prefixo, o contador
    // de hoje herdaria de graça a contagem de tentativas que já tinham acontecido de
    // madrugada sob o esquema antigo (mesma data-string em UTC e em Brasília na maior parte
    // do dia), deixando a marca "no teto" antes do horário comercial nem começar. Documentos
    // antigos (sem o prefixo) ficam órfãos — não precisam de limpeza, nunca mais são lidos.
    const today = `br-${brasiliaDateNow(now)}`
    const alreadyToday = await this.dailyCounter.getCount(brand.userId, brand.brandId, today)
    if (alreadyToday >= slotsOpenByNow(brand.maxAutoPostsPerDay, now)) {
      return { ...base, action: 'skipped-not-yet-time' }
    }

    const suggestions = await this.generatorClient.suggestTopics(brand.brandId)
    if (suggestions.length === 0) return { ...base, action: 'skipped-no-suggestions' }

    // Achado real em produção: a notícia de maior audienceFitScore não muda a cada hora, então
    // considerar só a #1 (comportamento original) fazia a marca bater no mesmo tópico bloqueado
    // tick após tick, até o ranking de notícias mudar sozinho — às vezes várias horas depois.
    // Cai pra próxima da lista (#2, #3...) dentro do mesmo tick, limitado a
    // MAX_TOPIC_CANDIDATES_PER_TICK pra não disparar 1 chamada de classificação por sugestão
    // sem limite nenhum.
    const candidates = suggestions.slice(0, MAX_TOPIC_CANDIDATES_PER_TICK)
    let topSuggestion: AutonomyTopicSuggestion | undefined
    let classification: AutonomyClassification | undefined
    for (const candidate of candidates) {
      const result = await this.generatorClient.classifyAutonomy({
        topic: {
          headline: candidate.headline,
          summary: candidate.summary,
          rationale: candidate.rationale,
        },
        autoPublishTopics: brand.autoPublishTopics,
        blockedTopics: brand.blockedTopics,
        stylePreferences: brand.stylePreferences,
      })
      if (!result.blocked) {
        topSuggestion = candidate
        classification = result
        break
      }
    }
    if (!topSuggestion || !classification) {
      return { ...base, action: 'skipped-blocked', topicHeadline: candidates[0]!.headline }
    }

    const wantsAutoPublish = brand.autonomyLevel === 'automatic' && classification.autoPublishEligible
    if (brand.autonomyLevel === 'automatic' && !classification.autoPublishEligible) {
      // Automático age só dentro dos tópicos liberados — fora disso, nem rascunho é criado
      // automaticamente (o usuário não pediu geração automática para qualquer assunto).
      return { ...base, action: 'skipped-not-eligible', topicHeadline: topSuggestion.headline }
    }

    // Vale pros dois níveis de autonomia, não só pro automático — sem isso, semi-automático
    // (que nunca consultava o contador antes) geraria um rascunho novo a cada hora depois que
    // o tick deixou de ser 1x/dia. Admissão atômica final: o gate de horário acima já é uma
    // boa estimativa, mas não é atômico entre execuções concorrentes do tick.
    const underLimit = await this.dailyCounter.incrementIfUnderLimit(
      brand.userId,
      brand.brandId,
      today,
      brand.maxAutoPostsPerDay,
    )
    if (!underLimit) return { ...base, action: 'skipped-daily-limit', topicHeadline: topSuggestion.headline }

    const generateResult = await this.generatorClient.generate({
      brandId: brand.brandId,
      description: `${topSuggestion.headline}. ${topSuggestion.rationale}`,
      targetPlatforms,
      topicSuggestionId: topSuggestion.id,
      style: classification.recommendedStyle,
    })
    if (generateResult.status !== 'ready') {
      return {
        ...base,
        action: 'error',
        error: `generation did not finish ready (status: ${generateResult.status})`,
        topicHeadline: topSuggestion.headline,
      }
    }

    // GenerateContentUseCase não devolve o id do Post que acabou de criar — reencontrado
    // aqui pelo rascunho mais recente da marca, já ordenado por createdAt desc.
    const drafts = await this.postRepo.findByBrand(brand.userId, brand.brandId, 'ai-draft')
    const newestDraft = drafts[0]
    if (!newestDraft) {
      return {
        ...base,
        action: 'error',
        error: 'generation succeeded but no ai-draft post was found',
        topicHeadline: topSuggestion.headline,
      }
    }

    if (!wantsAutoPublish) return { ...base, action: 'draft-created', topicHeadline: topSuggestion.headline }

    await this.publishPostUseCase.execute(newestDraft.id, brand.userId, brand.brandId)
    return { ...base, action: 'published', topicHeadline: topSuggestion.headline }
  }
}
