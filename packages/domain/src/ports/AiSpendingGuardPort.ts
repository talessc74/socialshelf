// Soma o custo estimado (USD) de todos os eventos de uso de IA de uma marca a partir de
// `since` (inclusive) — usado pela trava de gasto diária (_local-edr-policy-073) logo antes de
// qualquer chamada de IA em GenerateContentUseCase/EditArtifactUseCase. Separado de
// AiUsageReaderPort de propósito: aquele é para exibição (todos os eventos, agregação em
// memória), este é uma soma pontual e barata (filtro por data direto na consulta), chamada a
// cada geração — não deve pagar o custo de buscar o histórico inteiro da marca toda vez.
export interface AiSpendingGuardPort {
  sumCostUsdSince(userId: string, brandId: string, since: Date): Promise<number>
}
