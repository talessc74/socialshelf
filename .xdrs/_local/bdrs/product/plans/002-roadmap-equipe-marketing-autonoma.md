# _local-bdr-plan-002: Roadmap — SocialShelf como Equipe Autônoma de Marketing e Analytics

## Executive Summary

- O SocialShelf deixa de ser definido como "ferramenta de publicação" e passa a ser definido como **sistema autônomo de marketing e analytics**, ancorado na marca do usuário: conecta às redes, escuta insights e audiência, entende o público, decide pauta, cria conteúdo (post, carrossel ou outro formato), opera publicação (manual ou autônoma) e mede resultado para recalibrar o próximo ciclo.
- O desenvolvimento segue seis fases (F0–F5) ordenadas por dependência de dados — cada fase produz o sinal que a próxima fase consome. Não são fases de preferência; são impostas pelo loop: não se mede o que não foi publicado, não se decide pauta sem entender público, não se entende público sem escutar, não se escuta sem estar conectado.
- A camada de Conexão (OAuth multiplataforma, cofre de tokens) já está em produção e é a fundação sobre a qual as fases seguintes são construídas — nenhuma fase reconstrói essa camada.
- Arranque recomendado: F0 (Núcleo da Marca) e abertura de F1 (Escuta) em paralelo com a trilha de minimização de dados, que deve ser decidida antes de qualquer ingestão de insight de audiência.
- Toda fase produz documentação XDRS própria (ADR/EDR/BDR) antes de ser considerada concluída — este plano não substitui a documentação detalhada de cada decisão dentro da fase.

## Context and Problem Statement

A `_local-bdr-policy-002-socialshelf-plataforma-e-produto` define o SocialShelf como SaaS de publicação com foco exclusivo em publicação, e cita explicitamente que o sistema "não gerencia comunidades, DMs ou comentários" e que analytics é funcionalidade de sprint futuro sem desenho definido.

Essa definição não reflete mais a visão de produto. O SocialShelf deve operar como uma equipe de marketing e analytics completa para o usuário: ler o desempenho das redes conectadas, entender a audiência, buscar conteúdo relevante ao nicho, sugerir e criar posts (validados pelo usuário ou de forma autônoma dentro de limites), publicar e medir — recalibrando o próprio comportamento a partir do resultado medido.

Como estruturar o desenvolvimento dessa visão sem violar o que já está em produção, e em que ordem construir cada camada para que cada uma tenha o dado de que precisa quando for construída?

## Proposed Solution

Desenvolver o produto em seis fases sequenciais (F0–F5), onde cada fase é a camada de dados que a fase seguinte consome como entrada. Trilhas transversais (marca como contexto, dial de autonomia, integridade factual, minimização de dados, sistema de design, governança XDRS) atravessam todas as fases e são decididas o mais cedo possível, mesmo que sua implementação plena dependa de fases posteriores.

Expected end date: 2027-12-31

Data provisória — datas por fase são responsabilidade do roadmap de sprints (`_local-bdr-plan-001-roadmap-sprints`), que deve ser atualizado para encaixar estas fases conforme cada uma for iniciada.

## Approach

Cada fase é aberta com deliberação ARGUS convocando as galeras com jurisdição sobre o tema da fase (ex: F1 convoca Segurança para a trilha de minimização antes de qualquer ingestão de dado de audiência). Nenhuma fase é considerada iniciada sem que sua decisão estrutural esteja registrada como ADR, e nenhuma fase é considerada concluída sem que suas decisões de implementação estejam registradas como EDR.

Risco identificado e endereçado por trilha, não por fase isolada — porque os riscos (privacidade de audiência, integridade factual, dano de publicação autônoma) atravessam múltiplas fases e precisam de uma decisão única e consistente, não uma por fase.

## Milestones

### Fase 0: Núcleo da Marca
Due date: a definir

Planejado. Pré-requisito de todas as fases seguintes — sem perfil de marca rico, toda geração de conteúdo é genérica.

**Key tasks:**
- Modelo de domínio `BrandProfile` cobrindo Negócio, Identidade, Visual, Voz, Narrativa e Operação.
- Snapshot imutável de marca por post (cada post referencia a versão de marca vigente no momento da criação).
- Modelagem do **dial de autonomia** (manual → semi-automático → automático) como atributo de operação da marca, ainda sem ativação de publicação autônoma.
- Ambiente de "conhecimento de marca": interface onde o usuário alimenta o `BrandProfile` por múltiplas vias — upload de documento, texto livre, e leitura das redes já conectadas (via OAuth, Fase de Conexão) para a IA inferir tom de voz, temas recorrentes e identidade visual a partir do histórico de posts. Pedido explícito do usuário (2026-06-20), registrado aqui para não se perder antes da Fase 0 ser aberta.

**Riscos:**
- Modelar marca de forma rígida demais trava a evolução das fases seguintes. Mitigação: tratar `BrandProfile` como agregado versionável, não como configuração fixa.

---

### Fase 1: Escuta — Insights e Audiência
Due date: a definir

Planejado. Depende de Fase 0 (snapshot de marca já deve existir para contextualizar o sinal de audiência).

**Key tasks:**
- Adapters de leitura de analytics por plataforma (engajamento, alcance, performance por post), seguindo o padrão hexagonal de portas e adapters já estabelecido para integrações externas.
- Derivação de sinal agregado de audiência ("o público responde a X") a partir do dado bruto de cada plataforma.
- Decisão de minimização de dados: o sistema retém sinal agregado, nunca base identificável de seguidores.
- Inclui o cenário pedido pelo usuário (2026-06-20): IA lendo os posts já publicados no Instagram (e demais redes conectadas) para entender o que gerou mais leads/alcance, e usar esse sinal para orientar o que postar a seguir.

**Riscos:**
- Ingestão de dado de audiência sem decisão de minimização prévia cria passivo de privacidade. Mitigação: decisão de minimização registrada como ADR antes de qualquer ingestão real.

---

### Fase 2: Pauta Inteligente — Notícia Verificada e Sugestão
Due date: a definir

Planejado. Depende de Fase 1 (sinal de audiência é insumo para casar pauta com público).

**Key tasks:**
- Ingestão de notícia por nicho de interesse do usuário.
- Pipeline de verificação factual com fonte rastreável antes de qualquer gancho factual ser usado em sugestão de pauta.
- Motor de sugestão de pauta casando notícia verificada com sinal de audiência da Fase 1.

**Riscos:**
- Sugestão de pauta sem verificação factual gera desinformação em escala, sob a marca do usuário. Mitigação: nenhuma pauta chega à Fase 3 sem fonte rastreável associada.

---

### Fase 3: Criação Multiformato
Due date: a definir

Planejado. Depende de Fase 2 (pauta verificada é insumo da criação).

**Key tasks:**
- Extensão do agregado de geração de conteúdo (`_local-adr-policy-019-generation-state-machine`) para suportar post como conjunto de N≥1 artefatos — post único é o caso de um artefato, carrossel é o caso de N artefatos, sem bifurcação de lógica entre os dois.
- Aplicação dos tokens de marca (Fase 0) a qualquer formato gerado.
- CTA automático sugerido a partir da pauta e do formato.
- Estado de geração granular por artefato, com feedback de progresso individual.

**Riscos:**
- Tratar carrossel como caminho de código paralelo ao post único duplica manutenção. Mitigação: modelagem como agregado único desde o início da fase.

---

### Fase 4: Operação e Autonomia
Due date: a definir

Planejado. Depende de Fase 3 (precisa haver conteúdo gerado para operar e publicar).

**Key tasks:**
- Workflow completo de revisão (Kanban) e agendamento sobre a máquina de estados de post já existente (`_local-adr-policy-018-post-state-machine`).
- Ativação do dial de autonomia modelado na Fase 0: do nível manual até o nível automático dentro de limites declarados.
- Guardrails obrigatórios antes de qualquer publicação autônoma: limite de frequência, interrupção manual imediata do modo automático, e exclusão explícita de temas sensíveis do fluxo automático.

**Riscos:**
- Publicação autônoma sem guardrail é dano irreversível na conta real do usuário. Mitigação: guardrails são pré-condição de ativação do modo automático, não um ajuste posterior.

---

### Fase 5: Loop de Avaliação Contínua
Due date: a definir

Planejado. Depende de todas as fases anteriores — só existe medição depois que há publicação, e só há recalibração depois que existe pauta e sinal de audiência para realimentar.

**Key tasks:**
- Medição de performance pós-publicação por artefato.
- Recalibração do sinal de audiência (Fase 1) e do motor de sugestão de pauta (Fase 2) a partir do resultado medido.
- Métrica de sucesso de produto definida e registrada como decisão de negócio.

## References

- [_local-bdr-policy-002-socialshelf-plataforma-e-produto](../002-plataforma-produto.md) - Definição de produto anterior, em revisão por este plano
- [_local-bdr-plan-001-roadmap-sprints](001-roadmap-sprints.md) - Roadmap de sprints de execução, a ser encaixado com estas fases
- [_local-adr-policy-018-post-maquina-de-estados-de-publicacao](../../../adrs/application/018-post-state-machine.md) - Máquina de estados estendida na Fase 4
- [_local-adr-policy-019-generation-request-maquina-de-estados](../../../adrs/application/019-generation-state-machine.md) - Agregado de geração estendido na Fase 3
- [_local-adr-policy-002-arquitetura-hexagonal](../../../adrs/application/002-hexagonal-architecture.md) - Padrão de portas e adapters seguido pelos adapters de analytics da Fase 1
