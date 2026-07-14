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

**Sim — Selfie como assistente contextual, ativado apenas por evento de estado real da aplicação, nunca por ociosidade ou tempo, com dispensa permanente por dica individual.**

Selfie reaproveita o personagem já validado como camada de comunicação de duas necessidades já documentadas: mostrar a IA trabalhando (Princípio 1 da BDR-006) e orientar o usuário pelo produto (achabilidade). Primeira integração: `/dashboard/generate`, narrando os estágios reais de `GenerationArtifact.status`. Segunda onda, após validação da primeira: onboarding de conexão de rede social e criação de `BrandProfile` vazio.

### Details

**Gatilhos permitidos**

- Mudança de estado real observável: transição de `GenerationArtifact.status`, primeira visita a uma tela, campo obrigatório detectado vazio.
- Nunca por tempo ocioso, contagem de sessão ou recorrência programada ("a cada N minutos/dias"). Esse é o padrão que tornou o Clippy repudiado pelos usuários; reproduzi-lo aqui é tratado como defeito de produto, não escolha de estilo.

**Regra de dispensa**

- Cada dica tem identificador único. Uma vez dispensada, fica registrada em `dismissedTips: string[]` por usuário (Firestore) e nunca mais reaparece, em nenhuma sessão ou dispositivo.
- Dispensar uma dica não desliga Selfie inteiro — dispensa é por conteúdo, não global. Desligar Selfie por completo é preferência explícita separada do usuário.

**Acessibilidade**

- Respeita `prefers-reduced-motion`: animação de flutuação/gesto é substituída por estado estático com balão de texto, sem perda de conteúdo.
- Balão de dica é navegável e dispensável via teclado; não pode bloquear leitor de tela.

**Forma técnica**

- Animação vetorial (Lottie ou Rive) derivada da imagem de referência já aprovada — não usa geração de vídeo. Esse fluxo é independente do pipeline de vídeo em avaliação para anúncios (TikTok/YouTube).
- Lógica de gatilho implementada como mapa `evento -> dica`, desacoplada da tela que o consome, seguindo o mesmo espírito de portas/adapters já usado no projeto.

**O que fica fora desta decisão**

- Conteúdo textual final de cada dica — implementação, seguindo o tom de voz definido em `_local-bdr-policy-005`.
- Especificação de animação (keyframes) — decisão de design, não arquitetural.
- Interação por texto livre (chat) com Selfie — fora de escopo; esta decisão cobre apenas dicas contextuais unidirecionais.

## Conflicts

Nenhum identificado. Esta decisão estende `_local-bdr-policy-006` (Princípios 1 e 3) e opera dentro da hierarquia de conflito já definida por `_local-bdr-policy-001`; não substitui nem diverge de nenhuma policy existente.

## References

- [_local-bdr-policy-006-visao-de-experiencia-de-produto](006-visao-experiencia-produto.md) - Origem do requisito de IA visível e mascote
- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Hierarquia HCD -> Usabilidade Empírica -> Findability que limita gatilhos e dispensa
- [_local-bdr-policy-005-tokens-identidade-visual](005-tokens-identidade-visual.md) - Tom de voz e componentes-padrão a seguir no conteúdo das dicas
- [_local-bdr-policy-010-paleta-logo-identidade-visual](010-paleta-logo-identidade-visual.md) - Paleta usada na imagem de referência do Selfie
- [_local-adr-policy-002-arquitetura-hexagonal](../../adrs/application/002-hexagonal-architecture.md) - Padrão de portas e adapters seguido pelo serviço de gatilho
