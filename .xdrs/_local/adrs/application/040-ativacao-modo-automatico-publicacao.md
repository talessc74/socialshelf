---
name: _local-adr-policy-040-ativacao-do-modo-automatico-de-publicacao
description: Ativa o dial de autonomia modelado na Fase 0 (_local-adr-policy-018) para publicação real, com os guardrails exigidos pela Fase 4 do roadmap (_local-bdr-plan-002) como pré-condição, não como ajuste posterior. Use ao entender por que o dial de autonomia passou a ter efeito real, ou ao mexer em qualquer guardrail deste modo.
apply-to: apps/publisher — tick de autonomia; apps/generator — classificação semântica de pauta; apps/web — configuração de operação da marca
valid-from: 2026-07-10
---

# _local-adr-policy-040: Ativação do Modo Automático de Publicação

## Context and Problem Statement

`_local-bdr-plan-002` (Fase 0) já modelou o dial de autonomia (`manual` → `semi-automatic` → `automatic`) como atributo de `BrandProfile.operation`, mas deixou registrado explicitamente: "ainda sem ativação de publicação autônoma". Até esta decisão, o campo existia e era editável na tela de marca, mas nenhum código do sistema o lia — selecionar "Automático" não mudava nada no comportamento real.

O mesmo roadmap, na Fase 4, já registra o risco de ativar isso sem cuidado: "Publicação autônoma sem guardrail é dano irreversível na conta real do usuário", e fixa a mitigação: "guardrails são pré-condição de ativação do modo automático, não um ajuste posterior". Como ativar o dial de autonomia de fato — geração e publicação sem clique humano — sem violar essa pré-condição?

## Decision Outcome

**Um tick diário no publisher-service processa marcas com `autonomyLevel` diferente de `manual`, gerando 1 post por marca a partir da pauta de maior aderência do dia. Três guardrails são pré-condição de qualquer publicação sem revisão: teto diário definido pelo próprio usuário (não um valor fixo do sistema), classificação semântica de bloqueio antes de qualquer rascunho, e escopo do modo automático restrito aos tópicos explicitamente liberados.**

### Details

**Por que um tick diário, não uma fila reativa a eventos**

Notícia nova não é um evento discreto e barato de observar (ao contrário de "post agendado venceu", que já tem um poller de minuto no publisher-service) — encontrar pauta relevante exige buscar, verificar e pontuar notícia via IA, um custo que não vale repetir a cada minuto por marca. Cadência diária equilibra atualidade com custo, e replica o mesmo padrão operacional já em produção para outros ticks periódicos (limpeza de vídeo de 7 dias, publicação agendada).

**Guardrail 1 — teto diário definido pelo usuário, não fixo pelo sistema**

Decisão explícita do usuário durante a especificação desta feature: em vez de um limite fixo (ex: sempre 1 por dia), a tela de marca pergunta ao usuário o teto quando ele seleciona "Automático" — `maxAutoPostsPerDay`, validado entre 1 e 10 tanto na UI quanto no schema do backend (o backend nunca confia apenas na validação da UI). O contador que aplica esse teto é por marca, por dia, e reseta sozinho porque a chave do documento já inclui a data — sem job de limpeza separado.

**Guardrail 2 — corte manual imediato via leitura fresca a cada tick**

Não existe um botão de emergência separado: o tick sempre lê o `BrandProfile` mais recente no início de cada execução (`AutonomyBrandDiscoveryPort.findEligibleBrands`), então trocar o dial de volta para `manual` a qualquer momento já impede a próxima execução de agir sobre aquela marca — a interrupção é imediata porque não há estado em cache entre ticks.

**Guardrail 3 — exclusão semântica de temas sensíveis antes de qualquer rascunho**

Toda pauta candidata passa por `TopicAutonomyMatcherPort` (implementado via Gemini, mesma stack de IA já usada no resto do pipeline) antes de gerar qualquer conteúdo — inclusive no modo `semi-automatic`, que não publica sozinho mas ainda assim não deve rascunhar a partir de um tema que o usuário marcou como bloqueado. A classificação é semântica, não correspondência literal de palavra-chave: "política" bloqueado deve pegar uma notícia sobre eleição mesmo que a palavra "política" nunca apareça no texto. Em caso de dúvida do modelo, a orientação de prompt é bloquear — o risco de publicar algo sensível pesa mais que o de perder uma publicação.

**Modo automático é mais restrito que semi-automático, não apenas "semi-automático + publicar"**

`semi-automatic` rascunha qualquer pauta não bloqueada. `automatic` só age (rascunha e publica) quando a pauta também se encaixa em `autoPublishTopics` — o conjunto de temas que o usuário liberou explicitamente para publicação sem revisão. Uma pauta não bloqueada mas fora desse conjunto não vira nada no modo automático: nem rascunho. Isso é deliberado — o usuário não pediu para a IA criar conteúdo automaticamente sobre qualquer assunto, só publicar sem revisão sobre os assuntos que ele liberou.

**Por que publisher-service hospeda o tick, não generator-service**

generator-service tem toda a infraestrutura de IA (Gemini, geração de imagem) e é quem primeiro parecia o lugar natural. Mas a ordem de deploy no `deploy.yml` já tem `deploy-publisher` dependendo da URL de `deploy-generator` (`needs: [bootstrap-iam, deploy-generator]`) — se o tick precisasse ficar em generator-service chamando publisher-service para publicar, isso criaria uma dependência circular de deploy (cada serviço precisando da URL do outro antes de existir). publisher-service já chama generator-service para outra coisa (`resolveImageUrl` em `publish.routes.ts`) e já hospeda `PublishPostUseCase` localmente — hospedar o tick lá evita a nova chamada cruzada na direção que quebraria o deploy, e reaproveita a chamada na direção que já existe.

## What this does not solve

Música/vídeo no pipeline automático (o tick só gera post de imagem/texto — TikTok fica de fora do alvo automático pela mesma razão que fica de fora de "publicar também em"). Recalibração do sinal de audiência a partir do resultado medido (Fase 5 do roadmap, ainda não iniciada). Extensão de um `Post` existente com mais plataformas em vez de sempre criar um novo (mesma lacuna já registrada em `_local-edr-policy-037`).

## References

- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 4 define os guardrails que esta decisão implementa como pré-condição
- [_local-adr-policy-018-post-maquina-de-estados-de-publicacao](018-post-state-machine.md) - Estado `ai-draft` reaproveitado sem alteração pelo tick
- [_local-adr-policy-019-generation-request-maquina-de-estados](019-generation-state-machine.md) - Pipeline de geração reaproveitado sem alteração pelo tick
- [_local-edr-policy-037-publicar-em-mais-redes-apos-o-video](../../edrs/application/037-publicar-em-outras-redes-apos-video.md) - Mesma exclusão de TikTok e mesmo padrão "sempre cria Post novo"
