---
name: _local-bdr-policy-011-selfie-assistente-contextual
description: Define o personagem Selfie como assistente contextual de interface, os gatilhos permitidos, a regra de dispensa por dica e os guardrails de acessibilidade. Use ao projetar qualquer superfície onde Selfie apareça ou ao decidir se uma nova dica deve ser adicionada.
apply-to: apps/web — telas onde o SocialShelf narra trabalho de IA ou orienta o usuário
valid-from: 2026-07-14
---

# _local-bdr-policy-011: Selfie — Assistente Contextual do Produto

## Context and Problem Statement

`_local-bdr-policy-006` registrou um problema real de produto: na tela de geração, o usuário não percebe o que a IA está fazendo, mesmo o backend já expondo progresso granular por artefato (`GenerationArtifact.status`). A mesma policy exige que a IA seja "visível fazendo o trabalho" e que a direção visual inclua mascote, não formulário genérico. O personagem Selfie já foi validado visualmente (imagem de referência aprovada, paleta alinhada ao logo).

Falta decidir se Selfie deve virar um assistente de interface e sob quais regras — sem repetir a falha histórica desse tipo de recurso (o Clippy da Microsoft), cuja causa de rejeição em massa foi interrupção sem critério, não a existência de um personagem.

Question: O SocialShelf deve ter um assistente de interface baseado no Selfie, e sob quais regras ele pode aparecer sem violar a hierarquia de ergonomia cognitiva já estabelecida pela `_local-bdr-policy-001`?

## Decision Outcome

**Sim — Selfie como assistente contextual, ativado apenas por evento de estado real da aplicação, nunca por ociosidade ou tempo. Dispensa é um flag global por dispositivo (não por dica individual).**

Selfie reaproveita o personagem já validado como camada de comunicação de duas necessidades já documentadas: mostrar a IA trabalhando (Princípio 1 da BDR-006) e orientar o usuário pelo produto (achabilidade). Primeira integração: `/dashboard/generate`, narrando os estágios reais de `GenerationArtifact.status`.

### Details

**Gatilhos permitidos**

- Mudança de estado real observável: transição de `GenerationArtifact.status`, dado de uma tela terminando de carregar, primeira visita a uma tela, campo obrigatório detectado vazio.
- Nunca por tempo ocioso, contagem de sessão ou recorrência programada ("a cada N minutos/dias"). Esse é o padrão que tornou o Clippy repudiado pelos usuários; reproduzi-lo aqui é tratado como defeito de produto, não escolha de estilo.

**Regra de dispensa**

- O botão × desliga o Selfie inteiro por dispositivo (flag global, `localStorage`) — ver correção abaixo, "Atualização 2026-07-14".

**Acessibilidade**

- Respeita `prefers-reduced-motion`: animação de flutuação/gesto é substituída por estado estático com balão de texto, sem perda de conteúdo.
- Balão de dica é navegável e dispensável via teclado; não pode bloquear leitor de tela.

**Forma técnica**

- Lógica de gatilho desacoplada da tela que o consome (cada tela computa sua própria mensagem a partir do dado já carregado e publica via hook compartilhado), mesmo espírito de portas/adapters já usado no projeto. Detalhe de implementação em `_local-edr-policy-049`.

**O que fica fora desta decisão**

- Conteúdo textual final de cada mensagem — implementação, seguindo o tom de voz definido em `_local-bdr-policy-005`.
- Especificação de animação (keyframes) — decisão de design, não arquitetural.
- Interação por texto livre (chat) com Selfie — fora de escopo; esta decisão cobre apenas mensagens contextuais unidirecionais.

### Atualização 2026-07-14 — Selfie expandido para todas as telas do produto; correção do modelo de dispensa

A "segunda onda" descrita na versão original desta policy (onboarding, adiado até validação da primeira tela) foi substituída por decisão direta do usuário: Selfie ganhou interação própria em **todas** as telas do dashboard (Notícias, Performance, Agenda, Campanhas, Marca, Contas, Compose, Insights, Início), não só geração. Detalhe de cada tela — gatilho, fonte de dado, mensagem — registrado na `_local-edr-policy-049` (atualizada na mesma data).

Essa expansão expôs uma inconsistência na decisão original que precisa ser corrigida aqui: o texto anterior definia dispensa "permanente por dica individual" (`dismissedTips: string[]`, Firestore), pensado para uma dica estática de onboarding. Com conteúdo dinâmico (o melhor post muda, a notícia do dia muda, o resumo da agenda muda a cada visita), dispensar permanentemente pelo conteúdo de hoje tornaria a mensagem inútil amanhã — o mecanismo nunca chegou a ser implementado dessa forma. **A regra vigente, já implementada desde o primeiro corte (EDR-049) e mantida na expansão, é: um único flag global por dispositivo (`localStorage`) — "não quero mais ver o Selfie", não "não quero ver esta dica específica".** Isso substitui a seção "Regra de dispensa" da versão original.

## Conflicts

Nenhum identificado. Esta decisão estende `_local-bdr-policy-006` (Princípios 1 e 3) e opera dentro da hierarquia de conflito já definida por `_local-bdr-policy-001`; não substitui nem diverge de nenhuma policy existente.

## References

- [_local-bdr-policy-006-visao-de-experiencia-de-produto](006-visao-experiencia-produto.md) - Origem do requisito de IA visível e mascote
- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Hierarquia HCD -> Usabilidade Empírica -> Findability que limita gatilhos e dispensa
- [_local-bdr-policy-005-tokens-identidade-visual](005-tokens-identidade-visual.md) - Tom de voz e componentes-padrão a seguir no conteúdo das dicas
- [_local-bdr-policy-010-paleta-logo-identidade-visual](010-paleta-logo-identidade-visual.md) - Paleta usada na imagem de referência do Selfie
- [_local-adr-policy-002-arquitetura-hexagonal](../../adrs/application/002-hexagonal-architecture.md) - Padrão de portas e adapters seguido pelo serviço de gatilho
- [_local-edr-policy-049-selfie-implementacao](../../edrs/application/049-selfie-implementacao.md) - Decisões de implementação, incluindo o mapeamento tela a tela da expansão de 2026-07-14
