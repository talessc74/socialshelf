---
name: _local-edr-policy-056-repost-so-publica-plataforma-disponivel
description: Repostar um post que tinha X (Twitter) no conteúdo original deixava o X pré-selecionado e invisível (o chip "Em breve" não é clicável), e ele era publicado mesmo assim porque validSelectedPlatforms só filtrava pelo enum, não pelas plataformas indisponíveis. Agora validSelectedPlatforms exclui unavailablePlatforms. Use ao mexer na seleção de plataformas do compose/repost.
apply-to: apps/web — dashboard/compose/page.tsx (validSelectedPlatforms)
valid-from: 2026-07-19
---

# _local-edr-policy-056: Repost só publica plataforma disponível

## Context and Problem Statement

Usuário reportou (com o erro na tela, agora visível por _local-edr-policy-054): tentou repostar
escolhendo **só Instagram**, mas ao publicar o **X (Twitter) também tentou** e falhou
("X token refresh failed: 400 ... token was invalid").

Investigação da tela de compose (`/dashboard/compose?repostFrom=...`):

- No prefill do repost, `setSelectedPlatforms(new Set(repostSource.content.map((c) => c.platform)))`
  copia **todas** as plataformas do post original pra seleção — incluindo o X, que os posts do tick
  de autonomia carregavam no conteúdo.
- O X está em `COMING_SOON_PLATFORMS` e é renderizado como um chip **"Em breve" não-clicável**
  (um `<span cursor-not-allowed>`, não um `<button>`). Ou seja: o usuário **não consegue
  desmarcá-lo** — ele fica preso na seleção, invisível como "selecionado".
- Havia `useEffect`s de reconciliação que removiam de `selectedPlatforms` as plataformas que exigem
  imagem/vídeo quando o requisito não é atendido — mas **nenhum** removia as `COMING_SOON`.
- `validSelectedPlatforms` (fonte do que é publicado: `buildContent`, `canPublish`, `buildVideo`)
  filtrava só por `validPlatforms.has(p)` (o enum). O X é um membro válido do enum, então passava —
  e o post criado saía com conteúdo pra X, que ia pra publicação e falhava.

## Decision Outcome

**`validSelectedPlatforms` passa a excluir também `unavailablePlatforms`, não só o que está fora do
enum.** É a fonte única da verdade do "o que será de fato publicado".

```ts
const validSelectedPlatforms = [...selectedPlatforms].filter(
  (p) => validPlatforms.has(p) && !unavailablePlatforms.has(p),
)
```

### Details

`unavailablePlatforms` já reúne os três motivos de indisponibilidade (`COMING_SOON_PLATFORMS`,
`blockedForNoImage`, `blockedForNoVideo`). Filtrar por ele garante que nenhuma plataforma
indisponível chegue ao conteúdo publicado, **independente de como entrou na seleção** — seja pelo
prefill do repost (o caso do bug), seja por uma corrida com os `useEffect`s de reconciliação (que
rodam depois do render). Não há inconsistência visual: o chip do X já é renderizado como `<span>`
"Em breve" fora da lista clicável, então nunca aparece como selecionado/destacado; excluí-lo de
`validSelectedPlatforms` só corrige o que conta, sem mudar o visual.

Não regride TikTok nem Instagram: `blockedForNoVideo` só contém TikTok enquanto não há vídeo pronto,
e `blockedForNoImage` só contém as que exigem imagem enquanto não há imagem — assim que o requisito é
atendido, a plataforma sai de `unavailablePlatforms` e volta a contar normalmente.

## What this does not solve

Não muda o fato de o X ainda estar "em breve" (a API de publicação do X exige plano pago — ver o
aviso na própria tela). Não toca no erro de permissão do Instagram (code 190 / pages_*), que é
questão de token/App Review do lado da Meta, não de seleção de plataforma.

## References

- [_local-edr-policy-054-falhas-de-publicacao-visiveis](054-falhas-de-publicacao-visiveis.md) - Tornou visível a falha por rede que expôs este bug (o X aparecendo como falha num repost "só Instagram")
