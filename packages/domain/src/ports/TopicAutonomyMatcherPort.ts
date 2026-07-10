export interface TopicAutonomyMatch {
  // Verdadeiro se a pauta se encaixa em algum tema bloqueado da marca — nesse caso, nem o
  // modo semi-automático deve rascunhar a partir dela.
  blocked: boolean
  // Verdadeiro se a pauta se encaixa no espírito de "Tópicos com publicação automática
  // liberada" da marca — só importa para o modo automático; irrelevante em semi-automático.
  autoPublishEligible: boolean
}

export interface TopicAutonomyMatcherPort {
  classify(input: {
    topic: { headline: string; summary: string; rationale: string }
    autoPublishTopics: string[]
    blockedTopics: string[]
  }): Promise<TopicAutonomyMatch>
}
