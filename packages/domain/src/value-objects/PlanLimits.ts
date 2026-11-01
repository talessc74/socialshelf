import type { AccountType } from '../entities/AccountType.js'
import type { AutonomyLevel } from '../entities/BrandProfile.js'
import type { PlanTier, Subscription } from '../entities/Subscription.js'

// Ordem de severidade dos níveis de autonomia — usada para comparar o nível salvo numa marca
// contra o teto do plano (quanto maior o índice, mais autônomo). _local-adr-policy-0NN.
const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = ['manual', 'semi-automatic', 'automatic']

export function isAutonomyLevelWithinPlan(level: AutonomyLevel, maxLevel: AutonomyLevel): boolean {
  return AUTONOMY_LEVEL_ORDER.indexOf(level) <= AUTONOMY_LEVEL_ORDER.indexOf(maxLevel)
}

export interface PlanLimits {
  tier: PlanTier
  // null = ilimitado (só 'legacy'/admin). Nunca usar Infinity aqui — Infinity vira null em
  // JSON.stringify (achado real: o bypass de admin/legado quebraria silenciosamente na borda
  // HTTP, onde GET /billing/subscription serializa PlanLimits pro frontend), então null é o
  // próprio valor usado, de ponta a ponta, em vez de um sentinel numérico.
  includedBrands: number | null
  allowedAccountTypes: AccountType[]
  // Preço (BRL/mês) de cada marca profissional adicional além das incluídas — null quando o
  // tier não permite marca adicional nenhuma (free/starter/legacy).
  additionalBrandPriceBrl: number | null
  maxAutonomyLevel: AutonomyLevel
  maxAutoPostsPerDayCeiling: number
  // Em dias — null significa histórico sem corte (só 'legacy').
  historyRetentionDays: number | null
  // Créditos de IA incluídos por mês-calendário (1 crédito = 1 imagem gerada = R$0,22, ver
  // Credits.ts) — substitui defaultDailyAiSpendingLimitBrl (_local-adr-policy-0NN,
  // descontinua _local-edr-policy-073). null significa ilimitado (só 'legacy'/admin).
  monthlyCreditsIncluded: number | null
  // Vídeo para TikTok está fora de todos os planos por enquanto — publicação real travada por
  // falta de CNPJ (mesmo bloqueio documentado em _local-bdr-policy-012 para o Meta App Review),
  // não uma limitação técnica. Vira "em breve" na vitrine até o bloqueio ser resolvido.
  allowTikTokVideo: boolean
  allowPhotoCampaigns: boolean
  allowPerformanceAnalytics: boolean
}

// Tabela de planos (_local-bdr-policy-0NN) — única fonte de verdade consultada por todos os
// gates (criação de marca, geração de IA, tick de autonomia, features pagas). Nenhum gate deve
// guardar estes números hardcoded em outro lugar.
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  // Usuários anteriores ao corte de lançamento do billing — acesso ilimitado permanente,
  // nunca forçados a migrar (decisão de negócio registrada em _local-adr-policy-0NN, Fase 6).
  legacy: {
    tier: 'legacy',
    includedBrands: null,
    allowedAccountTypes: ['personal', 'professional'],
    additionalBrandPriceBrl: null,
    maxAutonomyLevel: 'automatic',
    maxAutoPostsPerDayCeiling: 10,
    historyRetentionDays: null,
    monthlyCreditsIncluded: null,
    // Única exceção: legacy/admin mantêm acesso de teste ao vídeo TikTok (contas usadas pra
    // validar o pipeline enquanto o app não passa pela revisão do TikTok, mesmo bloqueio de
    // CNPJ do Meta App Review em _local-bdr-policy-012) — os planos vendidos (free→agency)
    // não oferecem isso agora, só "em breve" na vitrine.
    allowTikTokVideo: true,
    allowPhotoCampaigns: true,
    allowPerformanceAnalytics: true,
  },
  free: {
    tier: 'free',
    includedBrands: 1,
    allowedAccountTypes: ['personal'],
    additionalBrandPriceBrl: null,
    maxAutonomyLevel: 'manual',
    maxAutoPostsPerDayCeiling: 1,
    historyRetentionDays: 7,
    monthlyCreditsIncluded: 30,
    allowTikTokVideo: false,
    allowPhotoCampaigns: false,
    allowPerformanceAnalytics: false,
  },
  starter: {
    tier: 'starter',
    includedBrands: 1,
    allowedAccountTypes: ['personal'],
    additionalBrandPriceBrl: null,
    maxAutonomyLevel: 'semi-automatic',
    maxAutoPostsPerDayCeiling: 1,
    historyRetentionDays: 30,
    monthlyCreditsIncluded: 100,
    allowTikTokVideo: false,
    allowPhotoCampaigns: false,
    allowPerformanceAnalytics: false,
  },
  pro: {
    tier: 'pro',
    includedBrands: 1,
    allowedAccountTypes: ['professional'],
    additionalBrandPriceBrl: 79,
    maxAutonomyLevel: 'automatic',
    maxAutoPostsPerDayCeiling: 2,
    historyRetentionDays: 180,
    monthlyCreditsIncluded: 200,
    allowTikTokVideo: false,
    allowPhotoCampaigns: true,
    allowPerformanceAnalytics: true,
  },
  agency: {
    tier: 'agency',
    includedBrands: 3,
    allowedAccountTypes: ['professional'],
    additionalBrandPriceBrl: 69,
    maxAutonomyLevel: 'automatic',
    maxAutoPostsPerDayCeiling: 3,
    historyRetentionDays: 365,
    monthlyCreditsIncluded: 600,
    allowTikTokVideo: false,
    allowPhotoCampaigns: true,
    allowPerformanceAnalytics: true,
  },
}

// Limites sintéticos "tudo liberado" para contas com adminOverrideUnlimited — espelha
// 'legacy' porque o propósito é o mesmo (nunca bloquear), mas mantém o tier real da
// assinatura visível em `subscription.tier` para fins de exibição/depuração.
function unlimitedPlanLimitsFor(tier: PlanTier): PlanLimits {
  return { ...PLAN_LIMITS['legacy'], tier }
}

// Ponto único de leitura de limites — todo gate chama esta função, nunca PLAN_LIMITS[tier]
// diretamente, para que o bypass de admin funcione em todo lugar sem repetir a checagem
// (_local-adr-policy-0NN, Fase 5).
export function resolveEffectivePlanLimits(subscription: Subscription): PlanLimits {
  if (subscription.adminOverrideUnlimited) {
    return unlimitedPlanLimitsFor(subscription.tier)
  }
  return PLAN_LIMITS[subscription.tier]
}
