---
name: _local-edr-policy-058-retry-em-media-nao-pronta-do-instagram
description: media_publish do Instagram rejeitava com "Media ID is not available" (code 9007/subcode 2207027) mesmo depois de waitUntilContainerReady confirmar status_code FINISHED — corrida documentada do lado da Meta entre o container reportar pronto e realmente estar disponível. Publish agora tenta de novo (até 5x, 3s de intervalo) só para esse código/subcódigo específico. Use ao mexer em MetaPublisher.publishInstagram.
apply-to: apps/publisher — MetaPublisher (publishInstagram)
valid-from: 2026-07-20
---

# _local-edr-policy-058: Retry em "media não pronta" do Instagram

## Context and Problem Statement

Usuário testou repostar um post só no Instagram, recém reconectado pelo Login do Instagram
(_local-edr-policy-057), e recebeu falha:

```
Instagram publish failed: 400 {"error":{"message":"Media ID is not available",
"type":"OAuthException","code":9007,"error_subcode":2207027,...}}
```

`_local-adr-policy-024` já documentava exatamente esse erro como motivo de existir
`waitUntilContainerReady` (poll de `status_code` até `FINISHED` antes do `/media_publish`).
Mas o erro ocorreu mesmo assim — confirmando que o poll não é garantia suficiente: é uma
corrida conhecida do lado da própria Meta entre o container reportar `status_code: FINISHED`
e o `/media_publish` de fato aceitar aquele `creation_id`. Não é peculiaridade do caminho novo
(Login do Instagram) nem do antigo (Facebook Login) — os dois usam o mesmo par
container-then-publish e estão igualmente sujeitos à corrida.

## Decision Outcome

**`/media_publish` tenta de novo (até 5 vezes, 3s de intervalo) quando a resposta é
especificamente `code: 9007, error_subcode: 2207027`; qualquer outro erro continua lançando
na primeira tentativa.**

### Details

**Retry no publish, não recriar o container**

O que falhou foi a chamada de publish, não a criação do container — o `creation_id` continua
válido, só não estava pronto naquele instante. Recriar o container desperdiçaria uma chamada de
API e um novo ciclo de processamento assíncrono da Meta, atrasando ainda mais a publicação.

**Filtro estrito por código/subcódigo, não por status HTTP genérico**

`isMediaNotReadyError` faz parse do corpo do erro e só considera candidato a retry a combinação
exata `code === 9007 && error_subcode === 2207027`. Qualquer outro 400 (permissão, token
inválido, conteúdo rejeitado) continua falhando imediatamente — não tem por que reter esses
erros, e mascarar um erro de permissão atrás de 5 tentativas com 3s cada (até 15s) seria pior
diagnóstico, não melhor.

**5 tentativas, 3s de intervalo — mesma ordem de grandeza do polling de container**

`CONTAINER_POLL_MAX_ATTEMPTS` (30 × 2s = até 60s) já assume que a Meta pode demorar até um
minuto pra processar um container do zero; a corrida pós-FINISHED costuma resolver em segundos,
não minutos, então 5×3s (até 15s) é suficiente sem impor uma espera longa demais numa falha que
não seja essa.

## What this does not solve

Não elimina a corrida do lado da Meta — só absorve o tempo que ela normalmente leva pra se
resolver. Se a Meta demorar mais que 15s (incomum, mas possível sob carga), a publicação ainda
falha e precisa ser repostada manualmente. Não se aplica ao carrossel item-a-item (cada item já
usa `waitUntilContainerReady` antes de virar filho do carrossel) nem ao container pai — só ao
`/media_publish` final, que é onde o erro de fato ocorreu.

## References

- [_local-adr-policy-024-instagram-publicacao-em-duas-etapas](../../adrs/integration/024-instagram-publicacao-duas-etapas.md) - Documentou o erro 9007/2207027 originalmente, motivando o wait antes deste retry
- [_local-edr-policy-057-login-do-instagram-sem-facebook](057-login-do-instagram-sem-facebook.md) - Conexão usada no teste que expôs esta falha
