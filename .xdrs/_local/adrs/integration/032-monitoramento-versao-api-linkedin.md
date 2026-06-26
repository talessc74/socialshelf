---
name: _local-adr-policy-032-monitoramento-versao-api-linkedin
description: Define como a versão da LinkedIn-Version header é mantida e monitorada para evitar sunset silencioso. Use ao tocar em LinkedInPublisher, LinkedInAnalyticsReader, ou ao investigar falhas de publicação no LinkedIn.
apply-to: apps/publisher — LinkedInPublisher, LinkedInAnalyticsReader
valid-from: 2026-06-26
---

# _local-adr-policy-032: Monitoramento de Versão da API do LinkedIn

## Context and Problem Statement

A LinkedIn REST API exige o header `LinkedIn-Version` no formato `YYYYMM`, fixado em
constante (`LI_VERSION`) em `LinkedInPublisher.ts` e `LinkedInAnalyticsReader.ts`.
A LinkedIn garante suporte por no mínimo 12 meses após o lançamento de uma versão;
após esse período, a versão pode ser desativada e a API passa a responder
`426 NONEXISTENT_VERSION`.

Em 2026-06-26 a publicação em produção falhou com
`426 Requested version 20240101 is not active` — a constante estava fixada em
`'202401'` (lançada em jan/2024) e havia sido sunsetada silenciosamente. Não havia
nenhum alerta ou processo que detectasse a proximidade do sunset antes da falha em
produção. Correção imediata: atualizar `LI_VERSION` para `'202602'` (PR #72, commit
`b3f2581`), validada em produção pelo usuário após o deploy.

Sem um processo de revisão periódica, o mesmo tipo de falha (sunset silencioso)
se repetirá a cada janela de ~12 meses.

## Decision Outcome

**Revisão manual trimestral da constante `LI_VERSION`, com data de expiração
documentada inline no código.**

Não implementar verificação automática de versão via chamada à API (a LinkedIn não
expõe endpoint de descoberta de versões ativas) — a mitigação é processo, não
código adicional no caminho de execução.

### Details

- `LI_VERSION` em `LinkedInPublisher.ts` e `LinkedInAnalyticsReader.ts` deve manter,
  em comentário adjacente, a data de lançamento da versão e a data estimada de
  sunset (lançamento + 12 meses), para tornar a expiração visível no código-fonte.
- Checklist operacional: a cada troca de trimestre, confirmar se a versão fixada
  ainda está dentro da janela de 12 meses de suporte; se estiver a menos de 60 dias
  do sunset estimado, atualizar para a versão mais recente disponível.
- Falhas de publicação no LinkedIn com status `426` devem ser tratadas como
  prioridade alta — indicam sunset de versão, não erro transitório, e bloqueiam
  100% das publicações na plataforma até correção.
- As duas constantes (`LinkedInPublisher` e `LinkedInAnalyticsReader`) devem ser
  atualizadas juntas, na mesma alteração, para evitar divergência de versão entre
  publicação e leitura de métricas.

## Consequences

- Boas: falha de classe inteira (sunset de versão) passa a ter processo de
  prevenção documentado, reduzindo a chance de recorrência silenciosa.
- Ruins: depende de disciplina manual (revisão trimestral) — não há gate
  automatizado de CI que bloqueie merge com versão prestes a expirar.
- Trade-off aceito: a LinkedIn não oferece endpoint de descoberta de versões ativas
  para automação; monitoramento automático real exigiria scraping de changelog
  externo, considerado fora de escopo por ora.

## References

- [_local-adr-policy-016-refresh-de-token-oauth-por-plataforma](016-refresh-token-oauth.md) - Estratégia de tokens de longa duração do LinkedIn, contexto de manutenção contínua da integração
