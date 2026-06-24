export interface NewsItem {
  title: string
  summary: string
  // Domínio raiz do veículo (ex.: https://www.reuters.com) — usado na verificação de fonte rastreável.
  sourceUrl: string
  // Link do artigo em si (ex.: redirect do Google News) — usado como melhor esforço para extrair o thumbnail.
  articleUrl: string
  sourceName: string
  publishedAt: Date
}
