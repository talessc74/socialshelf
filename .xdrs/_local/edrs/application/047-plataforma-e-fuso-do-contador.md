---
name: _local-edr-policy-047-plataforma-e-fuso-do-contador
description: Dois bugs reais de produção que impediam qualquer publicação automática — uma conexão OAuth com platform fora do enum derrubava a geração inteira (não só a plataforma ruim), e o contador diário do tick usava data UTC enquanto o gate de horário usa relógio de Brasília, saturando o dia seguinte antes da hora. Use ao investigar por que o modo automático/semi-automático não publicou nada apesar de configuração correta.
apply-to: apps/publisher — AutonomyTickUseCase (targetPlatforms e chave do contador diário)
valid-from: 2026-07-13
---

# _local-edr-policy-047: Plataforma e Fuso do Contador

## Context and Problem Statement

Usuário reportou o modo automático sem publicar nada por 2 dias, com `autonomyLevel=automatic` e `maxAutoPostsPerDay=3` confirmados corretos desde `_local-edr-policy-038` (2026-07-10). Diferente da investigação anterior (tick só rodava 1x/dia), desta vez a cadência já era de hora em hora — por quê ainda assim zero publicações?

## Decision Outcome

**Duas correções independentes em `AutonomyTickUseCase`, achadas em produção via Cloud Run logs e Firestore Console (Claude Cowork, sem acesso GCP direto deste ambiente): filtrar `targetPlatforms` contra o enum real antes de gerar, e trocar a chave do contador diário de data UTC para data de Brasília.**

### Details

**Bug 1 — plataforma fora do enum derrubava a geração inteira (PR #145)**

Duas hipóteses descartadas com dados reais antes da causa certa: nem exceção não tratada (`/internal/autonomy-tick` sempre respondeu 200, zero `severity>=ERROR` nas últimas 48h), nem `autonomy_tick_log` vazio de verdade (tinha 32 documentos — a suspeita de um catch silencioso enterrando o resultado estava errada). Causa real: `oauth_connections` guardava uma conexão órfã/legada com `platform: "TWITTER"` (fora do enum, que só aceita `'twitter'` minúsculo — doc ID em UUID solto, não o hash pairwise determinístico usado pelas conexões atuais, indicando um esquema de conexão anterior nunca limpo). `processBrand` monta `targetPlatforms` direto de `connections.map(c => c.platform)`, sem validar, e o schema de `/generate` (`z.array(platformEnum).min(1)`) rejeita o array inteiro quando qualquer item é inválido — não só o item ruim. Toda vez que o gate de horário abria, a geração falhava com 400 mesmo havendo Facebook/LinkedIn/Instagram válidos conectados na mesma marca; 6 tentativas confirmadas com essa mensagem exata no log. Correção: `targetPlatforms` passa a filtrar contra `ALL_PLATFORMS` (`packages/domain`), descartando qualquer valor fora do enum além do TikTok já excluído. Confirmado ao vivo: primeira entrada `action: "published"` da marca, `2026-07-13T02:02:51Z`, sem erro.

**Bug 2 — contador diário saturava antes do horário comercial de Brasília começar (PR #146)**

Achado ao validar o Bug 1 em produção, não hipotético: `autonomy_daily_counters/2026-07-13` já estava em `count: 3` (o teto) por volta de 02h UTC — horas antes das 9h de Brasília. `slotsOpenByNow` usa `brasiliaHourNow` (relógio de Brasília) pra decidir quantos slots já abriram, mas a chave do contador (`today`) vinha de `new Date().toISOString().slice(0, 10)`, data UTC. Entre 21h-24h de Brasília (0h-3h UTC do dia seguinte), o gate já trata o dia como no fim (todos os slots contam como abertos), mas o calendário UTC já tinha virado — as tentativas dessa janela (incluindo as 2 do Bug 1, que incrementam o contador antes de gerar, por design de `_local-edr-policy-038`) contaram contra o balde do dia seguinte, saturando-o antes desse dia (em Brasília) sequer começar. Correção: nova função `brasiliaDateNow`, mesma referência de fuso de `brasiliaHourNow`, vira a chave do contador. Sem migração de dado — o balde antigo com chave UTC só fica órfão e para de ser referenciado.

## What this does not solve

Por que `/dashboard/brand` mostrou o histórico do tick vazio pro usuário quando o Firestore já tinha os 32 documentos reais segue sem explicação — a rota (`apps/api/src/routes/autonomy-tick-log.routes.ts`) e o componente (`AutonomyTickHistory.tsx`) foram lidos e parecem corretos, mas a causa não foi reproduzida nesta rodada. Fica como próxima investigação caso o sintoma se repita. As conexões OAuth órfãs identificadas (`platform: "TWITTER"` maiúsculo expirada; um segundo documento de LinkedIn com esquema de ID antigo, ainda válido mas duplicado) não foram removidas do Firestore — o fix de código já as neutraliza, e o usuário optou por não intervir em dado de produção sem necessidade comprovada; seguem como débito técnico conhecido.

## References

- [_local-edr-policy-038-tick-de-autonomia-implementacao](038-tick-autonomia-implementacao.md) - Implementação original do tick, contador diário e gate de horário que esta correção ajusta
- [_local-adr-policy-040-ativacao-do-modo-automatico-de-publicacao](../../adrs/application/040-ativacao-modo-automatico-publicacao.md) - Decisão estrutural do modo automático
- PR #145 (`talessc74/socialshelf`) - Filtra plataformas fora do enum antes de gerar conteúdo no tick de autonomia
- PR #146 (`talessc74/socialshelf`) - Usa data de Brasília (não UTC) como chave do contador diário do tick de autonomia
