---
name: _local-edr-policy-076-normalizacao-de-content-de-post-legado
description: _local-edr-policy-074 corrigiu GeminiCopyGenerator para nunca mais gravar content[].text como array, mas não reparava Posts já corrompidos em produção — a mesma "entries: Expected string, received array" continuava aparecendo em Banco de Insights para marcas com posts antigos afetados. As 3 cópias de FirestorePostRepository (api, generator, publisher) agora normalizam content na leitura via postContentNormalization.ts, corrigindo o post de qualquer marca automaticamente, sem migração manual de dados. Use ao mexer em FirestorePostRepository, Post.content, ou ao decidir se um novo campo do domínio precisa da mesma tolerância de leitura para dado legado.
apply-to: apps/api — infrastructure/firestore/FirestorePostRepository.ts, infrastructure/firestore/postContentNormalization.ts; apps/generator — infrastructure/firestore/FirestorePostRepository.ts, infrastructure/firestore/postContentNormalization.ts; apps/publisher — infrastructure/firestore/FirestorePostRepository.ts, infrastructure/firestore/postContentNormalization.ts
valid-from: 2026-08-04
---

# _local-edr-policy-076: Normalização de content de post legado

## Context and Problem Statement

Depois de `_local-edr-policy-074` ir para produção, o usuário reportou que o mesmo erro em
Banco de Insights → Novas sugestões continuava aparecendo, com a mensagem idêntica
(`"entries":["Expected string, received array"]`) — inclusive com o commit já corrigido
(`8419a7f`) visível no ambiente.

O EDR-074 já previa esse cenário explicitamente na seção "What this does not solve": a correção
em `GeminiCopyGenerator` impede que **novos** posts nasçam com `content[].text` como array, mas
não repara nenhum Post que já tivesse sido gravado com esse formato quebrado antes do deploy.
Para a marca "Eai Jurídico" (e potencialmente outras), pelo menos um Post publicado já estava
corrompido dessa forma, e continuaria quebrando `GET /performance-suggestions` indefinidamente
até ser reeditado/republicado manualmente — coisa que o usuário não tinha como saber que
precisava fazer, nem qual post especificamente.

Sem acesso direto ao Firestore de produção nesta sessão para rodar uma migração pontual, a
correção precisava acontecer no código: qualquer leitura de um Post teria que tolerar o formato
antigo.

## Decision Outcome

**As 3 cópias de `FirestorePostRepository` (api-service, generator-service,
publisher-service — cada serviço tem a sua, sem infraestrutura compartilhada entre eles) agora
normalizam `content` na desserialização via um novo `postContentNormalization.ts`: se
`text` de uma plataforma foi persistido como array de parágrafos, junta com `\n\n`;
`charCount` é sempre recalculado a partir do texto final.**

### Details

**Normaliza na leitura, não migra o dado gravado**

Mesma filosofia de `_local-edr-policy-064` (`normalizeBrandProfileOperation`) e do próprio
`_local-edr-policy-074`: em vez de escrever e rodar um script de migração pontual contra
produção (arriscado, e que só corrigiria o que existe hoje, não cobriria um caso similar
futuro), a leitura em `fromFirestore()` sempre devolve um `Post.content` conforme ao contrato
do domínio (`text: string`). O documento no Firestore continua com o formato antigo até o post
ser salvo de novo por qualquer fluxo normal (editar, reagendar) — mas nenhum consumidor volta a
ver o formato quebrado.

**Por que nas 3 cópias, não só na do publisher-service**

O sintoma relatado (Banco de Insights) passa só pelo `FirestorePostRepository` do
publisher-service (`GetPostsPerformanceUseCase`), mas `apps/api` e `apps/generator` têm cada
uma sua própria cópia do mesmo repositório, com o mesmo cast sem validação
(`content: (data['content'] as Post['content']) ?? []`). Qualquer leitura de um Post
corrompido por essas outras duas — editar o post na tela de Agendados, reenviar pra geração,
etc. — corria o mesmo risco de propagar um `text` array adiante. Corrigir as 3 de uma vez evita
descobrir o mesmo bug de novo em outro fluxo mais tarde.

**Arquivo próprio, não inline no repositório**

Seguindo o padrão já estabelecido por `brandProfileNormalization.ts` (duplicado nos mesmos 3
serviços, um arquivo dedicado por serviço com sua própria função exportada e seu teste) — não
inline dentro da classe do repositório, para manter a normalização testável isoladamente sem
precisar mockar o Firestore.

## What this does not solve

Não apaga nem reescreve o documento corrompido no Firestore — a normalização acontece a cada
leitura, então o custo (mínimo: iterar um array pequeno) se repete a cada vez que o post é lido,
para sempre, a menos que ele seja salvo de novo por algum fluxo normal. Não cobre nenhum outro
campo do domínio que possa ter sofrido o mesmo tipo de corrupção por outro bug ainda não
descoberto — só `content[].text`, o campo confirmado pelo erro relatado.

## References

- [_local-edr-policy-074-copy-vira-array-quebra-insights](074-copy-de-post-como-array-quebra-insights.md) - Correção na origem (GeminiCopyGenerator) que esta decisão complementa, cobrindo o dado já gravado antes dela existir
- [_local-edr-policy-064-normalizacao-brandprofile-operation](064-normalizacao-brandprofile-operation.md) - Mesmo padrão de normalização-na-leitura para dado legado, aplicado antes a BrandProfileOperation
