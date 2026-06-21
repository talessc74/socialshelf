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

**Fotos próprias do usuário como fundo do card, e logo da marca como ícone fixo (2026-06-20)**

Usuário pediu duas coisas: (1) poder enviar fotos próprias para que o sistema apenas monte o card (template/headline) sobre elas, sem gerar uma imagem nova via Imagen; (2) ter o logo da marca aparecendo como um pequeno ícone em um canto fixo de cada card gerado.

`GenerationRequest.inputs.imageStoragePaths` já existia no domínio desde a Fase 3, mas era um campo morto — aceito pelos schemas Zod de `apps/api` e `apps/generator`, persistido, porém nunca lido pelo `GenerateContentUseCase`. Não havia, em lugar nenhum do projeto, um mecanismo de upload de arquivo (sem `@fastify/multipart`, sem rota de upload, sem input de arquivo no front-end) — nem mesmo para o campo `BrandProfile.visual.logoStoragePath`, que também já existia no domínio sem nenhuma forma de ser preenchido.

Decisão: criar um único mecanismo de upload genérico, reutilizado para as duas fotos (do usuário e do logo da marca), em vez de dois pipelines separados — segue o mesmo padrão hexagonal já estabelecido (apps/api como gateway autenticado magro, apps/generator com a lógica e credenciais de storage):

- `ImageStoragePort` ganha `download(path): Promise<{base64, mimeType}>`, implementado em `GcsImageStorage` via `file.download()` + `file.getMetadata()` (para o `contentType`).
- Nova rota interna `POST /images/upload` em `apps/generator` (protegida por `x-internal-secret`), que recebe `{userId, brandId, base64, mimeType}` e delega a `imageStorage.upload(...)`, reaproveitando o método já existente (com `requestId` fixo `'upload'`, já que não há `GenerationRequest` neste momento).
- `apps/api` ganha `@fastify/multipart` (registrado em `app.ts`, limite de 10MB e 1 arquivo por requisição) e uma rota proxy autenticada `POST /images/upload`, que valida o `mimetype` (`image/png`, `image/jpeg`, `image/webp`), converte o arquivo para base64 e repassa ao `generator-service`.
- `apps/web`: `api.uploadImage(file)` (multipart `FormData`) retorna o `path` do storage.

**Fotos próprias**: `GenerateContentUseCase`, para cada artefato, passa a checar `input.imageStoragePaths[artifact.position - 1]` antes de chamar `ImageGeneratorPort.generateImage` — se houver um path de foto enviada pelo usuário naquela posição, a imagem de fundo é obtida via `imageStorage.download(path)` em vez de gerada pelo Imagen; o restante do fluxo (headline, template, logo) é idêntico. Cards sem foto correspondente continuam gerando via Imagen normalmente — é possível misturar fotos próprias com geração por IA no mesmo carrossel. No front-end, `/dashboard/generate` ganha um input de arquivo múltiplo ("Suas fotos — opcional"), limitado a `artifactCount` arquivos (truncado automaticamente se o usuário reduzir a quantidade de artefatos depois de já ter selecionado fotos); ao gerar, cada arquivo é enviado via `api.uploadImage` e os paths resultantes (na ordem de seleção = posição do card) são enviados como `imageStoragePaths` em `generateContent`. `EditArtifactUseCase` (edição de card via chat) não foi estendido para reaproveitar fotos próprias — uma edição por instrução sempre regera via Imagen, já que não existe hoje um modelo de edição de imagem (apenas geração); ajustar esse comportamento é decisão de fase futura.

**Logo da marca**: `TemplateRenderInput` ganha `logoImage: {base64, mimeType} | null`. `GenerateContentUseCase` e `EditArtifactUseCase`, ao buscar o `BrandProfile`, baixam `brandProfile.visual.logoStoragePath` (se presente) via `imageStorage.download(...)` e passam o resultado a `TemplateRendererPort.render`. `SharpTemplateRenderer` compõe o logo, redimensionado via `sharp().resize()` (mantendo proporção, `fit: 'inside'`) para 12% da menor dimensão da imagem, no canto inferior direito com margem de 4% — posição fixa, não configurável nesta fase (catálogo fechado, mesmo espírito do catálogo fechado de `TemplateStyle`). Como ainda não existe uma tela de edição de perfil de marca em `apps/web`, o upload do logo foi anexado ao painel lateral de `/dashboard/generate` (componente `LogoUploader`, visível quando há `BrandProfile` cadastrado): envia o arquivo via `api.uploadImage`, depois grava o path resultante via novo `api.updateBrandProfile(...)` (PUT `/brand-profile`, que já aceitava `logoStoragePath` no schema, mas não tinha nenhum chamador no front-end). Criar uma tela dedicada de configuração de marca é melhoria futura.

**Imagem desconectada da mensagem, e barra de texto obrigatória mesmo sem necessidade (2026-06-21)**

Uso real expôs duas falhas distintas. (1) A imagem de fundo era gerada a partir de `input.description` — a descrição crua digitada pelo usuário — enquanto o headline real (gerado pelo Gemini, considerando pauta verificada e voz da marca) nunca alimentava de volta o prompt do Imagen; resultado: fotos genéricas, fracamente relacionadas à mensagem de cada slide. (2) `SharpTemplateRenderer` desenhava a faixa de texto incondicionalmente, mesmo quando não havia necessidade real de uma — a barra era tratada como obrigatória, não como uma escolha de composição.

Deliberação convocou AETHER · NEXUS · COMPASS · EMPIRICUS (Design/UX) e SCOUT (viabilidade técnica). Convergência: o texto exibido ao usuário final **nunca** deve ser desenhado pelo Imagen — modelos de geração de imagem não renderizam texto em português de forma confiável (acentos, legibilidade), classe de defeito já observada duas vezes nesta base (texto ilegível em carrossel; códigos hex vazando como texto literal). Texto com propósito continua vindo exclusivamente do overlay vetorial determinístico (`SharpTemplateRenderer`); a melhoria é fazer a **imagem** nascer do mesmo contexto narrativo do **texto**, e fazer a barra existir apenas quando há texto para mostrar — nunca as duas fontes de texto coexistindo na mesma região.

Decisão:

- `CopyGenerationResult` ganha `visualBriefs: string[]` (mesma cardinalidade de `headlines`, mesma ordem) — uma cena descrita em inglês por slide, derivada do headline daquele slide especificamente (não da descrição genérica do post). `GeminiCopyGenerator` pede os dois arrays na mesma chamada, já que o Gemini tem o contexto completo (pauta, voz da marca, ângulo narrativo) que o Imagen nunca teve. `GenerationRequest.outputs.visualBriefs` persiste o resultado para que `EditArtifactUseCase` possa reaproveitá-lo em vez de description bruta.
- `GenerateContentUseCase` e `EditArtifactUseCase` passam a chamar `ImageGeneratorPort.generateImage({ description: visualBriefs[i], ... })` em vez de `input.description`.
- `ImagePrompt` ganha `templateStyle: TemplateStyle` e `hasTextOverlay: boolean` (computado como `headline.trim().length > 0`). Quando `hasTextOverlay` é true, `ImagenImageGenerator` adiciona uma instrução de composição específica da zona do `templateStyle` escolhido (terço inferior para `bold-bottom`, faixa superior para `top-strip`, centro para `centered-overlay`) — pede uma área visualmente "calma" ali, não texto nenhum. Isso é a "imagem que aceita uma barra por cima" sem nunca pedir ao Imagen para desenhar palavras.
- `SharpTemplateRenderer.render()` só desenha o retângulo + texto do template quando `input.headline.trim().length > 0` — sem headline, o card final é só a foto + selo do logo, sem faixa colorida vazia. Esta é a "verificação se precisa de texto acima da imagem" exigida: a decisão já existe (`hasTextOverlay`/checagem de headline vazio), não depende de configuração nova do usuário nesta fase.
- Não foi implementada a opção de o Imagen desenhar texto literal integrado à imagem (a "terceira via" considerada) — risco de confiabilidade descartado deliberadamente por SCOUT, dado o histórico de bugs de texto ilegível nesta mesma classe de problema; pode ser revisitado no futuro só se/quando houver um modelo de geração de imagem com renderização de texto comprovadamente confiável em português.

**Instrução de "zona calma" reintroduziu o próprio bug que evitava (2026-06-21, correção)**

A seção anterior introduziu `textZoneInstruction`, dizendo ao Imagen explicitamente que "uma barra de texto será sobreposta" em determinada região. Em produção, isso teve o efeito oposto ao pretendido: o Imagen passou a interpretar a cena como uma peça publicitária com "espaço reservado para legenda" — padrão fortemente presente em fotos de banco de imagens com `copy space` — e preencheu essa região com texto fictício ilegível (frases sem sentido tipo lorem-ipsum), exatamente sobre a faixa onde o headline real seria desenhado.

Correção: `textZoneInstruction` nunca mais menciona texto, legenda, barra ou propósito — a instrução passa a ser puramente fotográfica (tom uniforme, baixo contraste, fora de foco na zona relevante), sem dar ao modelo nenhum motivo para associar aquela área a uma peça com escrita. `negativePrompt` ganha termos adicionais (`lorem ipsum`, `placeholder text`, `gibberish text`, `fake subtitles`, `advertisement copy`) como reforço, mas a instrução positiva — nunca dar ao modelo um motivo para "reservar espaço para texto" — é a correção real; negativePrompt por si só não havia sido suficiente da primeira vez.

## References

- [_local-adr-policy-028-geracao-de-conteudo-multiartefato](028-geracao-multiartefato.md) - Decisão anterior (texto só por instrução), superada nesta parte por este ADR
- [_local-adr-policy-025-brandprofile-schema-versionamento](025-brand-profile-schema-versionamento.md) - Onde moram `primaryColor`/`secondaryColor`/`typography`
- [_local-bdr-plan-002-roadmap-equipe-marketing-autonoma](../../bdrs/product/plans/002-roadmap-equipe-marketing-autonoma.md) - Fase 3, Criação Multiformato
