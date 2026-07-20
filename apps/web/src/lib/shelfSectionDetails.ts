import type { ShelfSectionId } from './shelfSections'

/**
 * Conteúdo da "folha aberta" de cada livro (Fase 2). A folha é a segunda página
 * do livro — carrega a identidade da seção e resume o que ela faz, com um CTA
 * que leva à rota real, onde toda a funcionalidade de hoje continua intacta
 * (ver _local-bdr-policy-010, seção redesign, e o handoff: a folha é a porta de
 * entrada, não recria o produto).
 */

export interface SectionDetail {
  /** Frase de abertura, no tom da seção. */
  intro: string
  /** O que a pessoa faz nesta seção (recursos reais que já existem hoje). */
  does: string[]
  /** Rótulo do botão que abre a tela real. */
  cta: string
}

export const SECTION_DETAILS: Record<ShelfSectionId, SectionDetail> = {
  agenda: {
    intro: 'Seu calendário editorial — tudo que está no forno e o que a IA já deixou pronto pra você aprovar.',
    does: [
      'Ver os posts agendados em calendário ou lista',
      'Aprovar (ou descartar) os rascunhos que a IA preparou',
      'Editar o texto por rede, trocar fotos e remarcar a data',
      'Publicar agora, cancelar ou repostar o que já saiu',
    ],
    cta: 'Abrir a Agenda',
  },
  noticias: {
    intro: 'A redação da sua marca: notícias quentes e ideias de pauta que a IA garimpou pra você.',
    does: [
      'Buscar e folhear notícias para virar pauta',
      'Ver o viral score e o melhor horário de cada ideia',
      'Guardar sugestões na prateleira para publicar depois',
      'Transformar qualquer notícia em post com um clique',
    ],
    cta: 'Abrir as Notícias',
  },
  desempenho: {
    intro: 'A prancheta de análise: o que seus posts renderam, rede por rede, com diagnóstico da IA.',
    does: [
      'Acompanhar impressões e engajamento no tempo',
      'Ver a performance separada por rede social',
      'Ler o Diagnóstico de Perfil gerado pela IA',
      'Semear uma nova criação a partir do que funcionou',
    ],
    cta: 'Abrir o Desempenho',
  },
  criar: {
    intro: 'O estúdio: descreva a ideia e a IA monta o post — ou escreva do seu jeito, no manual.',
    does: [
      'Gerar posts com IA num assistente de 3 passos',
      'Subir suas fotos, escolher template e proporção',
      'Editar o resultado (texto ou imagem) com a IA',
      'Montar carrossel, slideshow e publicar ou agendar',
    ],
    cta: 'Abrir o Criar',
  },
  campanhas: {
    intro: 'Ensaios fotográficos no automático: suba um lote de fotos e deixe a publicação fluir.',
    does: [
      'Subir várias fotos de uma vez (arrastar e soltar)',
      'Reordenar e remover fotos da campanha',
      'Gerar e revisar a linha do tempo de publicação',
      'Ativar, estender ou cancelar a campanha',
    ],
    cta: 'Abrir as Campanhas',
  },
  marca: {
    intro: 'A identidade da casa: quem é a sua marca, como ela fala e o quanto a IA pode agir sozinha.',
    does: [
      'Definir negócio, identidade e narrativa',
      'Ajustar a voz: tom, palavras e o que nunca usar',
      'Subir o logo e o visual da marca',
      'Escolher o nível de autonomia (manual, semi ou automático)',
    ],
    cta: 'Abrir a Marca',
  },
  redes: {
    intro: 'A central de conexões: onde suas redes sociais se ligam ao SocialShelf.',
    does: [
      'Conectar LinkedIn, Instagram, Facebook, X e TikTok',
      'Reconectar uma conta quando o acesso expira',
      'Ligar uma Página do LinkedIn (escolhendo a organização)',
      'Ver o estado de cada conexão num relance',
    ],
    cta: 'Abrir as Redes',
  },
}
