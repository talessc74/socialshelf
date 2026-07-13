import type { TemplateStyle } from '../entities/TemplateStyle.js'

export interface TopicAutonomyMatch {
  // Verdadeiro se a pauta se encaixa em algum tema bloqueado da marca — nesse caso, nem o
  // modo semi-automático deve rascunhar a partir dela.
  blocked: boolean
  // Verdadeiro se a pauta se encaixa no espírito de "Tópicos com publicação automática
  // liberada" da marca — só importa para o modo automático; irrelevante em semi-automático.
  autoPublishEligible: boolean
  // Sempre um dos valores recebidos em `stylePreferences`, escolhido pelo encaixe com o
  // assunto da pauta — não é sempre o primeiro da lista, é o que a IA julgar mais adequado
  // pra como aquele conteúdo específico deve ser apresentado.
  recommendedStyle: TemplateStyle
}

export interface TopicAutonomyMatcherPort {
  classify(input: {
    topic: { headline: string; summary: string; rationale: string }
    autoPublishTopics: string[]
    blockedTopics: string[]
    stylePreferences: TemplateStyle[]
  }): Promise<TopicAutonomyMatch>
}
