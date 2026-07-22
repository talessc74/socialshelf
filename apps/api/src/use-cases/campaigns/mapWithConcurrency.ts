// Roda `fn` sobre `items` com no máximo `limit` chamadas em voo ao mesmo tempo, preservando a
// ordem do resultado. Achado real em produção: GenerateCampaignTimelineUseCase disparava uma
// chamada de legenda por IA por item via Promise.all sem nenhum limite — numa campanha com
// dezenas de itens, isso lança dezenas de requisições simultâneas pro generator-service, que
// roda em Cloud Run com max-instances=2. O serviço não escala rápido o bastante pra absorver a
// rajada e devolve 503 puro (nem chega na rota) pra maioria das chamadas, derrubando a legenda
// de IA pra template em quase todo item. Processar em lotes pequenos respeita a capacidade real
// do serviço (recursos finitos — jurisdição RiverRaid) sem sacrificar o isolamento de falha por
// item já garantido por quem chama `fn`.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index]!, index)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}
