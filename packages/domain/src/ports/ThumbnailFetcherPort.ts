// Busca, por melhor esforço, uma imagem de capa (og:image / twitter:image) para uma notícia.
// Tenta primeiro a URL do artigo; se falhar, a URL de fallback (raiz do veículo). Nunca lança —
// retorna null quando nenhuma imagem confiável (https) é encontrada.
export interface ThumbnailFetcherPort {
  fetchThumbnail(articleUrl: string, fallbackUrl?: string): Promise<string | null>
}
