---
name: _local-bdr-policy-007-inventario-app-referencia-socialshelf-ia
description: Mapeia as funcionalidades do protótipo "SocialShelf IA" (criado pelo usuário no Google AI Studio) ao roadmap F0–F5 já existente, e decide antecipar o Dashboard de Performance e "Semear Criação" (parte da Fase 5) antes da conclusão da Fase 4. Use ao priorizar o próximo incremento de produto ou ao avaliar se uma funcionalidade do protótipo deve ser adotada.
apply-to: Priorização de roadmap e decisões sobre quais funcionalidades do protótipo de referência entram no produto real
valid-from: 2026-06-19
---

# _local-bdr-policy-007: Inventário do App de Referência e Antecipação da Fase 5

## Context and Problem Statement

O usuário compartilhou um protótipo próprio, "SocialShelf IA", construído por ele no Google AI Studio (React + Vite + Express + Gemini, sem arquitetura hexagonal, persistência simples em Firestore/localStorage). O protótipo é referência de **funcionalidade**, não de layout — o layout será repensado pela Galera de Design a partir do zero, sem copiar a UI do protótipo.

O protótipo tem uma quantidade de elementos visivelmente maior do que o produto real hoje, que o usuário descreveu como "resumido em criar um post". Era necessário entender exatamente o que esse protótipo faz para decidir o que vale herdar, o que já é melhor no produto real, e em que ordem implementar.

## Decision Outcome

**O protótipo não introduz uma visão de produto nova — ele preenche lacunas dentro das fases F1, F3, F4 e F5 já definidas em `_local-bdr-plan-002-roadmap-equipe-marketing-autonoma`. Nenhuma fase nova é criada. Decide-se antecipar dois itens da Fase 5 (Dashboard de Performance e "Semear Criação") para o próximo incremento, à frente da conclusão da Fase 4, porque sua pré-condição real (posts publicados com `externalId`) já existe em produção hoje — a publicação não depende do Kanban/autonomia da Fase 4 para existir.**

### Mapeamento de funcionalidades do protótipo → fases existentes

| Funcionalidade do protótipo | Fase | Status no produto real |
|---|---|---|
| Textarea de "base de conhecimento do produto" + anexos | F0 (Núcleo da Marca) | Superado — `BrandProfile` estruturado já é mais robusto que o texto livre do protótipo |
| Geração de copy + imagem por post | F3 (Criação Multiformato) | Em produção, mais rico (geração de imagem real via Imagen vs. Unsplash estático no protótipo) |
| **Refinar por crítica em linguagem natural** (reescrever rascunho com base em feedback do usuário, sem regenerar do zero) | F3 (Criação Multiformato) | **Ausente** — hoje só existe "gerar" e "publicar", sem iteração conversacional sobre o rascunho |
| Fluxo de revisão/aprovação (status `revisar` → `pronto` → `publicado`) | F4 (Operação e Autonomia) | **Ausente** — hoje o fluxo é gerar → publicar direto, sem Kanban nem aprovação intermediária |
| Agendador com rodízio multi-plataforma | F4 (Operação e Autonomia) | **Ausente** — é o "dial de autonomia" e o agendamento já previstos na Fase 4 |
| Dashboard de KPIs (views, likes, shares, engajamento médio) | F5 (Loop de Avaliação Contínua) | **Ausente** — `AudienceSignal` hoje só guarda agregado por plataforma, sem ranking por post |
| Ranking de posts por performance | F5 (Loop de Avaliação Contínua) | **Ausente** — `AnalyticsReaderPort.fetchPostMetrics` já existe e já é chamado por `ComputeAudienceSignalUseCase`, mas o resultado por post é descartado após a agregação |
| "Semear Criação" (usar post de sucesso como referência para a próxima geração) | F5 (Loop de Avaliação Contínua) | **Ausente** — é literalmente a "recalibração do motor de sugestão de pauta a partir do resultado medido" já prevista na Fase 5 |
| "Analisar Padrões com IA" (insights textuais sobre o que funciona) | F5 (Loop de Avaliação Contínua) | **Ausente** |
| Feed de atividade/logs | Transversal, sem fase própria | Não adotado nesta decisão — ver Riscos |
| Renderização específica por plataforma (carrossel, contador de caracteres) | Transversal, design | Repensado pela Galera de Design, não herdado visualmente do protótipo |

### Por que antecipar parte da Fase 5 antes de concluir a Fase 4

`_local-bdr-plan-002` define a Fase 5 como dependente de "todas as fases anteriores — só existe medição depois que há publicação". Essa dependência é conceitual (a ideia de avaliação contínua pressupõe um histórico publicado), não uma dependência técnica do Kanban/autonomia da Fase 4. A publicação manual (`POST /posts/:id/publish`) já está em produção desde antes deste roadmap — logo, já existem posts publicados com `externalIds` reais e métricas reais via `AnalyticsReaderPort`, suficientes para construir o Dashboard de Performance e o "Semear Criação" sem esperar o Kanban de revisão da Fase 4.

A Fase 4 continua sendo pré-requisito apenas para autonomia de publicação (publicar sem intervenção humana) — não para medir o que já foi publicado manualmente.

### Itens não adotados nesta decisão

- **Feed de atividade/logs**: o protótipo usa como auditoria geral de UI; decide-se não adotar agora por não ter dono de fase claro no roadmap atual. Pode ser revisitado dentro da Fase 4 (operação) quando o Kanban for desenhado.
- **Agendador com rodízio multi-plataforma**: pertence à Fase 4, não antecipado por esta decisão — depende do dial de autonomia (F0) já estar ativável, o que ainda não está modelado para publicação automática.
- **Três rotas órfãs de IA do protótipo** (`process-prose`, `analyze-structure`, `get-prompt-inspire`): resíduo de outro projeto do AI Studio, sem relação com o domínio de marketing. Não adotado.

## Próximo incremento (decisão de execução imediata)

Implementar, nesta ordem, dentro da Fase 5:
1. Endpoint e use case para listar posts publicados com métricas por post (reaproveitando `AnalyticsReaderPort.fetchPostMetrics`, já testado e em produção via `ComputeAudienceSignalUseCase`).
2. Tela de Dashboard de Performance no web: KPIs agregados + ranking de posts.
3. "Semear Criação": ação no ranking que pré-popula a tela de geração com o tema/descrição do post de melhor desempenho.
4. "Analisar Padrões com IA": uso de um novo adapter Gemini (mesmo padrão de `GeminiCopyGenerator`) para gerar insights textuais a partir dos posts publicados + métricas.

## Riscos

- Confundir "métrica medida" com "métrica garantida": nem toda plataforma tem `AnalyticsReaderPort` funcional hoje (verificar cobertura por `XAnalyticsReader`, `LinkedInAnalyticsReader`, `MetaAnalyticsReader`) — o dashboard deve mostrar claramente quais plataformas têm dado real e quais não têm, nunca preencher com zero/placeholder como se fosse medição (consistente com `_local-bdr-policy-001-principios-de-ux`, correção lógica antes de estética).
- Antecipar Fase 5 sem ter Fase 4 pode criar a expectativa indevida de que o produto já tem agendamento/autonomia — o Dashboard deve deixar claro que mede apenas o que já foi publicado manualmente.

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](plans/002-roadmap-equipe-marketing-autonoma.md) - Roadmap F0–F5 ao qual este inventário é mapeado; nenhuma fase nova é criada
- [_local-bdr-policy-006-visao-de-experiencia-produto](005-visao-experiencia-produto.md) - Princípio de honestidade de UI (nunca simular dado não medido) aplicado ao Dashboard de Performance
- [_local-bdr-policy-001-principios-de-ux](../principles/001-ux-principles.md) - Hierarquia de conflito de UX que governa a apresentação de métricas reais vs. ausentes
