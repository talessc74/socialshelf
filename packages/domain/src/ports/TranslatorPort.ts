export interface TranslateInput {
  texts: string[]
  // Idioma de destino em linguagem natural (ex.: "português do Brasil").
  targetLanguage: string
}

// Tradução fiel de textos curtos (manchetes, resumos de notícia). A implementação deve preservar
// a ordem e o tamanho do array de entrada e nunca editorializar — apenas traduzir.
export interface TranslatorPort {
  translate(input: TranslateInput): Promise<string[]>
}
