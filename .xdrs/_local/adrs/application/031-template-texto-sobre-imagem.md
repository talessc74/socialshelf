---
name: _local-adr-policy-031-template-texto-sobre-imagem
description: Define como o texto (headline) passa a ser desenhado de forma determinística sobre a imagem gerada, via seletor de estilo de template, em vez de depender do Imagen "desenhar" o texto. Use ao implementar ImageGeneratorPort, TemplateRendererPort, GenerateContentUseCase, ou o seletor de estilo no front-end.
apply-to: packages/domain — CopyGeneratorPort, ImageGeneratorPort, TemplateRendererPort; apps/generator — composição de template; apps/web — seletor de estilo em /dashboard/generate
valid-from: 2026-06-20
---

# _local-adr-policy-031: Template de Texto Sobre Imagem (Seletor de Estilo)

## Context and Problem Statement

[_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) decidiu que tokens de marca (cores, tipografia) entram como **instrução textual do prompt ao Imagen**, sem composição programática — e registrou explicitamente que pós-processamento determinístico (overlay de texto/logo) seria "decisão de fase futura".

Uso real em produção (2026-06-20, carrossel de 3 imagens sobre "juridiquês") mostrou a limitação dessa abordagem: o Imagen tenta desenhar texto dentro da imagem quando o prompt menciona palavras como "Habeas Corpus", produzindo texto ilegível/garbled. Um post real de referência do usuário (Instagram) usa texto nítido desenhado sobre a imagem, em um template visual consistente (faixa de texto, tipografia da marca, hierarquia clara) — isso não é alcançável apenas com instrução textual a um modelo de geração de imagem.

Como permitir que o usuário escolha um estilo de template e tenha um headline nítido, legível, na cor/tipografia da marca, desenhado sobre a imagem de fundo gerada por IA?

## Decision Outcome

**O Imagen continua gerando apenas a imagem de fundo (sem instrução de texto a desenhar). Um novo port `TemplateRendererPort`, implementado com `sharp` + SVG no `generator-service`, compõe deterministicamente um headline de texto sobre essa imagem de fundo, segundo um template de estilo escolhido pelo usuário.**

### Details

**Catálogo inicial de estilos** (`TemplateStyle`, 3 opções na Fase 3):

- `bold-bottom` — faixa sólida na cor primária da marca na parte inferior, headline em texto branco/contrastante.
- `centered-overlay` — gradiente escuro sobre a imagem inteira, headline centralizado.
- `top-strip` — faixa na cor secundária da marca no topo, headline em destaque.

Catálogo é uma lista fechada e pequena nesta fase — não é um editor de template livre. Evolução do catálogo (mais estilos, customização livre) é decisão de fase futura.

**Headline como novo campo de `CopyGeneratorPort`**

`CopyGenerationResult` ganha `headlines: string[]` (curto, ~80 caracteres cada, compartilhado entre plataformas) — distinto das `copies` por plataforma (que são a legenda completa). O Gemini gera os headlines junto com a copy, na mesma chamada. `GenerationRequest.outputs` passa a incluir `headlines: string[] | null` ao lado de `copies`/`cta`.

**Correção — um headline por slide, formando narrativa, não um headline repetido (2026-06-20)**

A primeira versão deste ADR previa um único `headline: string` reaproveitado em todos os artefatos de um carrossel. Em uso real, isso produziu carrosséis onde cada slide tinha imagem de fundo diferente mas o **mesmo texto repetido** em todos os cards — não é isso que um carrossel real faz (cada card avança uma narrativa: gancho → desenvolvimento → fechamento). Corrigido: `ContentInputs` ganha `artifactCount: number`; `CopyGeneratorPort.generateCopy()` retorna `headlines: string[]` com exatamente `artifactCount` itens, um por posição de slide; `GeminiCopyGenerator` instrui explicitamente o Gemini a gerar uma sequência narrativa quando `artifactCount > 1` (primeiro slide = gancho/problema, slides do meio = desenvolvimento, último = conclusão/CTA), e valida que o array retornado tem o tamanho exato esperado, falhando a geração de copy (não a de imagem) se o modelo devolver um número diferente. `GenerateContentUseCase` usa `headlines[artifact.position - 1]` ao renderizar o template de cada artefato.

**Fluxo de geração**

1. `GenerateContentUseCase` chama `CopyGeneratorPort.generateCopy()` → obtém `copies`, `cta`, `headline`.
2. Para cada artefato, chama `ImageGeneratorPort.generateImage()` (Imagen, sem instrução de texto) → imagem de fundo.
3. Chama `TemplateRendererPort.render({ backgroundImage, headline, style, brandTokens })` → imagem final com texto composto.
4. Só a imagem final (já com o texto) é enviada a `ImageStoragePort.upload()` — o storage não passa a conhecer "fundo" vs "composta": o contrato de `GenerationArtifact.imageStoragePath` não muda.

**Por que `sharp` + SVG, e não Puppeteer/Satori**

`sharp` já é dependência do `generator-service` (processamento de imagem), e o runtime Alpine já instala `vips`, que renderiza SVG via `librsvg` sem precisar de um navegador headless — menor superfície de runtime e menor tempo de cold start no Cloud Run do que Puppeteer. O texto é desenhado via elemento SVG `<text>` com fonte do sistema (requer pacote de fontes adicionado à imagem Docker do `generator-service`); não há suporte a fontes customizadas arbitrárias nesta fase — `typography` da marca mapeia para um conjunto fechado de pesos/famílias disponíveis no container (ex: `sans-serif bold` vs `serif`), não para upload de arquivo de fonte.

**Seletor de estilo no front-end**

`/dashboard/generate` ganha um campo de seleção de estilo no `FormView` (grid de 3 prévias, uma por `TemplateStyle`), enviado como `style` no corpo de `POST /generate`. Estilo é input transitório da geração (como `artifactCount`), não um atributo versionado do `BrandProfile` — o usuário escolhe por geração, podendo variar entre posts.

**Seletor de formato/proporção de imagem (2026-06-20)**

Cada plataforma recomenda uma proporção de imagem diferente (ex: quadrado, retrato, paisagem, stories vertical), e o usuário pediu para poder escolher o formato explicitamente em vez de a aplicação decidir silenciosamente. Novo enum `AspectRatio` em `packages/domain` com os valores exatamente suportados pelo parâmetro `parameters.aspectRatio` da API `:predict` do Imagen na Vertex AI — `1:1` (quadrado), `3:4` (retrato), `16:9` (paisagem), `9:16` (stories/vertical). Não existe suporte nativo a `4:5` (proporção recomendada hoje por Instagram/Facebook) no Imagen; `3:4` foi escolhido como substituto mais próximo disponível.

`ImagePrompt.aspectRatio` é passado ao Imagen via `parameters.aspectRatio` em `ImagenImageGenerator`. `GenerateContentInput.aspectRatio` flui do `POST /generate` (`generateSchema` com default `AspectRatio.SQUARE`) até o use-case, e é persistido em `GenerationRequest.inputs.aspectRatio` — é input por geração, no mesmo nível de `style`, não atributo de `BrandProfile`. `SharpTemplateRenderer` não precisou de mudança: já lê `width`/`height` da imagem de fundo real via `sharp(...).metadata()`, então compõe o template corretamente em qualquer proporção.

No front-end, `/dashboard/generate` ganha um segundo seletor visual (`ASPECT_RATIO_OPTIONS`, grid de 4 prévias) ao lado do seletor de estilo. O componente de exibição do resultado (`GeneratedImage` e os placeholders de status) deixam de usar a classe CSS fixa `aspect-square` e passam a usar uma classe derivada de `result.inputs.aspectRatio` (mapa `ASPECT_RATIO_CLASS`), para não cortar/distorcer imagens geradas em 16:9 ou 9:16.

**Visualização ampliada do carrossel e edição de card por instrução em chat (2026-06-20)**

Usuário pediu para poder abrir cada card do carrossel em tamanho maior, navegar entre os cards, marcar um card específico e pedir à IA — via chat — para ajustá-lo. Isso expôs uma lacuna: `style` (o `TemplateStyle` escolhido na geração) nunca era persistido em `GenerationRequest.inputs`, só existia como parâmetro transiente do use-case — sem isso, uma edição posterior não saberia que template reaplicar. `style` foi adicionado a `GenerationRequest.inputs` (mesmo nível de `aspectRatio`), espelhando exatamente o precedente já estabelecido para `aspectRatio`. Também foi corrigido um bug real em produção: `apps/api`'s `generateSchema` não incluía `style`/`aspectRatio`, então o Zod descartava silenciosamente esses campos no proxy `POST /generation-requests` — a feature de seletor de formato/estilo nunca chegava ao `generator-service` em produção até esta correção.

Novo `EditArtifactUseCase` em `apps/generator`: recebe `generationRequestId`, `position` e uma `instruction` em linguagem natural; busca o `GenerationRequest`, reusa `description` + `instruction` como novo prompt para `ImageGeneratorPort.generateImage`, e renderiza novamente com `TemplateRendererPort.render` usando o `style`/headline originais — sobrescrevendo apenas o artefato daquela posição (`updateOutputs`), sem afetar os demais cards nem a copy. Nova rota interna `POST /generation-requests/:id/artifacts/:position/edit` no `generator-service`, espelhada por uma rota proxy autenticada equivalente em `apps/api`.

No front-end, um componente `Lightbox` é aberto ao clicar em qualquer card do carrossel: mostra a imagem em tamanho grande, navegação por setas (clique ou teclado ←/→/Esc), indicador de posição, e um botão "Editar este card" que revela um campo de texto livre — o chat de edição. Ao enviar, chama `api.editArtifact(...)` e substitui o `result` completo no estado da página (`onResultUpdate`), refletindo a imagem atualizada sem fechar o modal. O gancho de produto no último card do carrossel (quando houver perfil de marca com produto cadastrado) foi identificado como melhoria futura — depende de campos de produto que `BrandProfile` ainda não tem, então não foi implementado nesta rodada.

## References

- [_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) - Decisão anterior (texto só por instrução), superada nesta parte por este ADR
- [_local-adr-policy-025-brandprofile-schema-versionamento](025-brand-profile-schema-versionamento.md) - Onde moram `primaryColor`/`secondaryColor`/`typography`
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 3, Criação Multiformato
