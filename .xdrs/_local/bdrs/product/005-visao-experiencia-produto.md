---
name: _local-bdr-policy-006-visao-de-experiencia-produto
description: Define como a experiência de produto do SocialShelf deve se sentir — rejeita minimalismo extremo, exige que a IA seja percebida como agente que faz o trabalho, não como formulário. Use ao projetar qualquer tela onde IA gera ou sugere conteúdo, e como critério de aceite de revisão visual.
apply-to: Toda tela onde o sistema gera, sugere ou recomenda algo via IA
valid-from: 2026-06-19
---

# _local-bdr-policy-006: Visão de Experiência de Produto

## Context and Problem Statement

A primeira entrega de identidade visual (`_local-bdr-policy-005-design-tokens-identidade-visual`) trocou apenas a paleta de cor do app (`brand.*` de azul-céu para magenta) e aplicou um fundo com padrão de pontos no dashboard. Isso foi entregue como se fosse "design", mas é apenas troca de token — a tela de geração de conteúdo (`/dashboard/generate`) continuou sendo um formulário puro: campo de texto, seletor de plataforma, botão. Nenhum componente, nenhuma camada de feedback de IA, nenhuma aplicação de voz de marca foi adicionada.

O usuário apontou corretamente dois problemas distintos:

1. **Visual**: o resultado parece "minimalismo extremo" — não é isso que as 25 imagens de referência (produto "Farol") mostraram. A referência é densa, calorosa, com mascote, gradientes, copy conversacional — o oposto de telas em branco com botões.
2. **Funcional**: se o usuário precisa escrever o que quer publicar, não está claro o que a IA de fato faz. Investigação do código (`GenerateContentUseCase.ts`, `GeminiCopyGenerator.ts`) confirma que a IA gera a copy final por plataforma e a imagem/card de cada artefato — mas a interface não comunica isso, e o gerador de copy não usa `BrandProfile.voice`, então a copy gerada é mais genérica do que deveria ser.

Qual é a experiência de produto que estamos construindo, e que critérios uma tela precisa satisfazer para ser considerada "concluída" em termos de produto — não apenas funcionalmente correta?

## Decision Outcome

**O SocialShelf não é minimalista. É um assistente de marketing que mostra o próprio trabalho sendo feito, com voz de marca aplicada de ponta a ponta — visual denso e caloroso, nunca uma tela em branco com campos e botão.**

Nenhuma tela que envolve geração ou sugestão de IA é considerada concluída apenas por estar funcionalmente correta (gerar o resultado certo) e ter tokens de cor aplicados. Ela precisa satisfazer os critérios abaixo.

### Details

**Princípio 1 — A IA precisa ser visível fazendo o trabalho**

- Toda tela de geração mostra o resultado sendo montado (preview ao vivo, progresso por artefato individual), nunca apenas um spinner genérico com texto "Gerando...".
- O backend já produz esse dado granular (`GenerationArtifact.status` por posição no Firestore) — a ausência desse feedback na UI é dívida de interface, não limitação técnica.
- Critério de aceite: se o usuário não consegue perceber, durante a geração, que a IA está produzindo algo específico (não apenas "carregando"), a tela está incompleta.

**Princípio 2 — Voz de marca é obrigatória em toda geração, não apenas nas imagens**

- `BrandProfile.voice` deve ser usado no prompt de geração de copy, com a mesma obrigatoriedade que `BrandProfile.visual` já é usado no prompt de geração de imagem.
- Geração sem `BrandProfile` carregado integralmente (voz + visual) é geração genérica por definição, e isso viola a premissa fundadora da Fase 0 do roadmap (`_local-bdr-plan-002-roadmap-equipe-marketing-autonoma`): "sem perfil de marca rico, toda geração de conteúdo é genérica".
- Este princípio é pré-requisito técnico do Princípio 3 — não é possível comunicar "uma marca está falando" se a marca não está, de fato, influenciando o texto gerado.

**Princípio 3 — Direção visual é densa e calorosa, nunca minimalista**

- Referência: produto "Farol" (25 imagens fornecidas) — gradientes orgânicos, ilustração/mascote, cards com textura e sombra, copy em primeira pessoa.
- "Minimalismo extremo" (tela branca, poucos elementos, hierarquia tipográfica simples) é explicitamente rejeitado como direção de produto. Não é o caminho, mesmo como ponto de partida intermediário.
- Token de cor aplicado isoladamente (como em `_local-bdr-policy-005`) não satisfaz este princípio — é pré-requisito, não entrega. Componentes-padrão definidos naquela policy (stepper, painel de recomendação, badge de score) precisam estar presentes e populados com dados reais para a tela ser considerada alinhada à visão.

**Critério de aceite consolidado**

Uma tela de IA está completa quando, e somente quando:
1. O usuário entende, sem explicação verbal, o que a IA está fazendo por ele (não apenas que "algo está carregando").
2. A copy/imagem gerada reflete a voz e identidade visual da marca carregada, de forma auditável (não coincidência).
3. A tela usa os componentes-padrão da identidade visual (stepper, painel de recomendação, badge de score conforme aplicável) e a densidade visual da referência — não um formulário genérico Tailwind.

## Riscos

- Confundir "densidade visual" com sobrecarga cognitiva violaria `_local-bdr-policy-001-principios-de-ux` (hierarquia que prioriza ergonomia cognitiva sobre estética). Mitigação: densidade é sobre calor visual e comunicação de progresso, não sobre adicionar elementos sem função — todo elemento denso precisa carregar informação real (estado, recomendação, score), não decoração vazia.
- Tratar este BDR como concluído sem aplicar os princípios na próxima implementação repetiria o erro desta entrega (token de cor isolado apresentado como solução). Mitigação: nenhuma entrega futura de tela de IA é considerada concluída sem avaliação explícita contra os três critérios de aceite acima.

## References

- [_local-bdr-policy-005-design-tokens-identidade-visual](../design/001-tokens-identidade-visual.md) - Paleta e componentes-padrão; pré-requisito técnico, não suficiente isoladamente
- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Hierarquia de conflito que limita densidade visual a elementos funcionais
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 0 (Núcleo da Marca) e Fase 3 (Criação Multiformato) — origem dos princípios de voz de marca e progresso granular por artefato
- [_local-bdr-policy-002-socialshelf-plataforma-e-produto](002-plataforma-produto.md) - Definição de produto como equipe autônoma de marketing, não ferramenta de formulário
