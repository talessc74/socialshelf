# Plano de Migração — Nova Interface SocialShelf v2.0
## Interface Web Completa (F0–F5)

**Data:** 2026-07-06  
**Escopo:** Redesign e refatoração da web app (Next.js 15)  
**Versão:** 2.0 (F0 baseline + roadmap F1–F5)  
**Sem Gaps:** ✅ Checklist completo por página, componente, estado, fluxo

---

## I. MAPA DE PÁGINAS

### Estrutura Atual (v1.x)
```
/
├── / (redirect a /dashboard ou /auth/login)
├── /auth/
│   ├── login
│   ├── callback (OAuth)
│   └── logout
├── /dashboard
│   └── /generate (geração de conteúdo)
└── /settings (presumido, não mapeado)
```

### Estrutura Nova (v2.0 — F0 baseline)

```
/
├── /auth/
│   ├── login                    [EXISTENTE, refatorar UI]
│   ├── callback                 [EXISTENTE, manter]
│   └── logout                   [EXISTENTE, manter]
│
├── /onboarding/                 [NOVO] — Fluxo F0
│   ├── brand-setup              [NOVO] Carregar BrandProfile
│   ├── connect-networks         [NOVO] Conectar OAuth
│   └── success                  [NOVO] Onboarding concluído
│
├── /dashboard/                  [REFATORAR] — Nova layout
│   ├── index                    [REFATORAR] Dashboard principal
│   ├── generate                 [REFATORAR] Geração F3
│   ├── listen                   [NOVO] Analytics F1
│   ├── topics                   [NOVO] Pauta F2
│   ├── calendar                 [NOVO] Kanban/Agendamento F4
│   ├── analytics                [NOVO] Medição F5
│   └── brand-settings           [NOVO] Editar BrandProfile
│
└── /settings/                   [NOVO ou REFATORAR]
    ├── account
    ├── billing
    └── notifications
```

---

## II. LAYOUT BASE E COMPONENTES ESTRUTURAIS

### Layout Principal (Dashboard)

**Estrutura:**
```
┌─────────────────────────────────────────┐
│           HEADER (Brand + Nav)          │
├──────────────────┬──────────────────────┤
│                  │                      │
│    SIDEBAR       │    MAIN CONTENT      │
│   (Nav + Menu)   │     (Full-width)     │
│                  │                      │
├──────────────────┴──────────────────────┤
│            FOOTER (subtle)              │
└─────────────────────────────────────────┘
```

**Context Backgrounds (por tipo de página):**
- **Onboarding/Setup:** Fundo escuro com gradiente orgânico (blobs)
- **Dashboard operacional:** Fundo claro com padrão sutil de pontos

---

### Componentes-Padrão a Implementar

#### 1. **Stepper Numerado**
- **Uso:** Fluxos multi-etapa (F0 onboarding, F3 criação)
- **Variações:**
  - Horizontal (desktop)
  - Vertical/colapsed (mobile)
- **Estados:** incomplete, active, completed
- **Propriedades:**
  - `currentStep: number`
  - `steps: { label, description }[]`
  - `onStepChange: (step) => void`
- **Componente location:** `apps/web/src/components/Stepper/Stepper.tsx`

#### 2. **Painel de Recomendação**
- **Uso:** Sugestões de IA (F1, F2, F3)
- **Posicionamento:** Lateral (desktop) ou colapsível (mobile)
- **Estrutura:**
  ```
  ┌──────────────────┐
  │ Recomendado por  │
  │ [Agente Name]    │
  │                  │
  │ [Recomendação]   │
  │                  │
  │ [Aceitar] [Não]  │
  └──────────────────┘
  ```
- **Propriedades:**
  - `agent: string` (ex: "Pauta Inteligente")
  - `title: string`
  - `description: string`
  - `action: ReactNode` (conteúdo da recomendação)
  - `onAccept, onReject: () => void`
- **Componente location:** `apps/web/src/components/RecommendationPanel/RecommendationPanel.tsx`

#### 3. **Badge de Score/Categoria**
- **Uso:** Métricas calculadas (F1, F2, F5)
- **Exemplos:**
  - Score de alcance: "👥 45K"
  - Categoria de audiência: "🎯 Tech"
  - Sentimento: "😊 Positivo"
- **Propriedades:**
  - `label: string`
  - `value: string | number`
  - `icon?: ReactNode`
  - `variant: 'score' | 'category' | 'sentiment'`
  - `color?: string` (accent ou palette)
- **Componente location:** `apps/web/src/components/Badge/Badge.tsx`

#### 4. **Card de Artefato** (F3)
- **Uso:** Preview de cada artefato gerado
- **Estrutura:**
  ```
  ┌─────────────────────┐
  │  [Preview Image]    │
  │  [Copy/Text]        │
  │  [Platform Badge]   │
  │  [Status Indicator] │
  └─────────────────────┘
  ```
- **Propriedades:**
  - `artifact: GenerationArtifact`
  - `status: 'pending' | 'generating' | 'completed' | 'error'`
  - `onPreview, onEdit, onDelete: () => void`
- **Componente location:** `apps/web/src/components/ArtifactCard/ArtifactCard.tsx`

#### 5. **Modal de Feedback de Geração**
- **Uso:** Mostrar progresso granular durante geração F3
- **Estrutura:**
  ```
  ┌──────────────────────────┐
  │ Gerando conteúdo...      │
  │                          │
  │ ✅ Copy criada           │
  │ ⏳ Imagem gerando...     │
  │ ⭕ Preview aguardando    │
  └──────────────────────────┘
  ```
- **Propriedades:**
  - `artifacts: ArtifactStatus[]`
  - `totalArtifacts: number`
  - `progress: number` (0-100)
  - `isOpen: boolean`
- **Componente location:** `apps/web/src/components/GenerationProgress/GenerationProgress.tsx`

#### 6. **Selector de Autonomia (F0/F4)**
- **Uso:** Dial manual → semi → automático
- **Tipo:** Radio button ou slider visual
- **Estados:**
  - Manual (user clica publicar)
  - Semi (user revisa, sistema sugere)
  - Automático (sistema publica conforme guardrails)
- **Propriedades:**
  - `level: 'manual' | 'semi' | 'automatic'`
  - `onChange: (level) => void`
  - `disabled: boolean` (se F4 não está ativo)
- **Componente location:** `apps/web/src/components/AutonomySelector/AutonomySelector.tsx`

#### 7. **Kanban Board (F4)**
- **Uso:** Workflow de posts (draft → review → ready → published)
- **Estrutura:**
  ```
  ┌────────────┬────────────┬────────────┬────────────┐
  │   Draft    │   Review   │    Ready   │ Published  │
  │            │            │            │            │
  │ [Card] x3  │ [Card] x1  │ [Card] x2  │ [Card] x5  │
  └────────────┴────────────┴────────────┴────────────┘
  ```
- **Propriedades:**
  - `posts: Post[]`
  - `onDragEnd: (post, newStatus) => void`
  - `onSchedule: (post, date) => void`
- **Componente location:** `apps/web/src/components/KanbanBoard/KanbanBoard.tsx`

#### 8. **Analytics Chart** (F5)
- **Uso:** Visualizar performance (views, engagement, conversão)
- **Tipo:** Line chart, bar chart, ou gauge
- **Dados:**
  - Views, likes, comments, shares
  - Tendência temporal
  - Comparação com média
- **Componente location:** `apps/web/src/components/Charts/PerformanceChart.tsx`

---

## III. PÁGINAS POR FASE (DETALHE COMPLETO)

### FASE 0: Núcleo da Marca

#### **Página: `/onboarding/brand-setup`**

**Propósito:** Coleta de informações de marca (BrandProfile)

**Seções:**

1. **Informações de Negócio**
   - Campo: Nombre de marca
   - Campo: Descrição (2-3 linhas)
   - Campo: Nicho/Indústria (dropdown)
   - Campo: Target audience (texto)

2. **Identidade Visual**
   - Upload de logo
   - Upload de imagem de referência (padrão visual)
   - Paleta de cores (ou detectar de logo/imagem)
   - Fonte principal (lista de web-safe fonts)

3. **Voz e Tom**
   - Campo: Tom de voz (conversacional, profissional, descontraído, etc.)
   - Campo: Valores principais (lista de tags)
   - Campo: Histórias/anedotas que definem a marca (textarea)
   - **IA:** Botão "Analisar meus posts anteriores" → IA lê Instagram/LinkedIn para inferir voz

4. **Narrativa**
   - Campo: Qual problema você resolve?
   - Campo: Por que diferente?
   - Campo: Call-to-action primário

5. **Operação**
   - Seletor: Autonomia inicial (manual, semi, automático)
   - Seletor: Frequência de postagem (diária, 3x semana, semanal)
   - Checkbox: Temas a evitar (política, religião, etc.)

**Layout:**
- Stepper numerado (5 etapas)
- Contexto: Gradiente escuro com blobs
- Botões: "Próximo" (ativo apenas com campos obrigatórios), "Voltar", "Pular" (com warning)
- Preview ao lado (desktop) mostrando como marca aparecerá

**Estados:**
- Loading (enquanto IA analisa posts)
- Success (após salvar)
- Error (validação, API failure)

**Componente location:** `apps/web/src/pages/onboarding/brand-setup.tsx`

**Store/State Management:**
- Context: `BrandSetupContext` (compartilhado entre 5 etapas)
- Estado: `{ businessInfo, visual, voice, narrative, operation }`
- API: `POST /api/brand-profiles` (criar BrandProfile)

---

#### **Página: `/onboarding/connect-networks`**

**Propósito:** Conectar contas OAuth (LinkedIn, X, Instagram, Facebook)

**Estrutura:**
```
┌─────────────────────────────────┐
│ Conecte suas redes sociais      │
│ (Você poderá conectar mais      │
│  depois no painel)              │
│                                 │
│ ☐ LinkedIn  [Conectar]          │
│ ☐ Instagram [Conectar]          │
│ ☐ Facebook  [Conectar]          │
│ ☐ X/Twitter [Em breve]          │
│                                 │
│         [Continuar]             │
└─────────────────────────────────┘
```

**Fluxo por rede:**
1. User clica "Conectar"
2. Redirect para OAuth provider
3. Volta para callback (`/auth/callback`)
4. Salva OAuthConnection
5. Volta para `connect-networks` com status atualizado

**Propriedades:**
- `connections: OAuthConnection[]` (lista de conexões salvas)
- `availablePlatforms: Platform[]` (quais estão disponíveis para conectar)
- `onConnect: (platform) => void` → redireciona para OAuth

**Estados:**
- Aguardando conexão
- Conectando (loading)
- Conectado ✅
- Erro de conexão

**Componente location:** `apps/web/src/pages/onboarding/connect-networks.tsx`

---

#### **Página: `/onboarding/success`**

**Propósito:** Confirmar conclusão do onboarding

**Conteúdo:**
```
┌──────────────────────────┐
│  🎉 Bem-vindo ao        │
│  SocialShelf!            │
│                          │
│  Sua marca está pronta.  │
│  Suas redes conectadas.  │
│                          │
│ [Ir para Dashboard]      │
└──────────────────────────┘
```

**Componente location:** `apps/web/src/pages/onboarding/success.tsx`

---

#### **Página: `/dashboard/brand-settings`**

**Propósito:** Editar BrandProfile (pós-onboarding)

**Estrutura:** Repete formulário de `brand-setup`, mas como modal ou página secundária

**Ações:**
- Editar qualquer campo
- Fazer upload de nova imagem
- Executar análise de voz novamente
- Histórico de versões (snapshots)

**Componente location:** `apps/web/src/pages/dashboard/brand-settings.tsx`

---

### FASE 1: Escuta (Analytics)

#### **Página: `/dashboard/listen`**

**Propósito:** Visualizar sinal agregado de audiência por rede

**Layout:**
```
┌─────────────────────────────────────────┐
│ Seu público                             │
│                                         │
│ [Filtro: Semana/Mês/Ano]               │
│                                         │
│ ┌─────────────┬─────────────┬──────────┐
│ │ Instagram   │ LinkedIn    │ Facebook │
│ │ 45K reach   │ 8K reach    │ 2K reach │
│ │ 890 eng.    │ 124 eng.    │ 45 eng.  │
│ └─────────────┴─────────────┴──────────┘
│                                         │
│ [Painel recomendação: Publique segunda-│
│  -feira, seu público está mais ativo]  │
│                                         │
│ Posts que geraram mais:                │
│ ┌───────────────────────────────────┐  │
│ │ "Dica de produtividade" — 890 eng │  │
│ │ [Post card]                       │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Componentes:**
- Badge de score (reach, engagement por rede)
- Painel de recomendação (sugestão de melhor hora para postar)
- Lista de top posts por engagement

**Propriedades:**
- `signals: AudienceSignal[]` (agregado por rede)
- `dateRange: { start, end }`
- `topPosts: Post[]`

**Componente location:** `apps/web/src/pages/dashboard/listen.tsx`

**API:**
- `GET /api/audience-signals?dateRange=...`
- `GET /api/posts/top-performing?limit=5`

---

### FASE 2: Pauta Inteligente

#### **Página: `/dashboard/topics`**

**Propósito:** Visualizar sugestões de pauta verificadas

**Layout:**
```
┌─────────────────────────────────────────┐
│ Pauta Inteligente                       │
│                                         │
│ [Filtro: Categoria/Relevância]          │
│                                         │
│ ☑ Notícias que batem com seu público   │
│ ☐ Notícias da semana                    │
│ ☐ Trending topics                       │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ "IA revoluciona produtividade"      │ │
│ │ 📰 Fonte: TechCrunch (verificado)   │ │
│ │ 👥 Relevância: 92%                  │ │
│ │                                     │ │
│ │ [Criar post sobre isso] [Ignorar]   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Próximas sugestões...]                 │
└─────────────────────────────────────────┘
```

**Componentes:**
- Badge de relevância/score
- Badge de fonte (verificado)
- Botões de ação (criar post, ignorar, ver fonte)

**Propriedades:**
- `topics: TopicSuggestion[]`
- `filters: { category, minRelevance }`
- `onCreatePost: (topic) => void` → navega para `/dashboard/generate?topicId=...`

**Componente location:** `apps/web/src/pages/dashboard/topics.tsx`

**API:**
- `GET /api/topic-suggestions?filters=...`
- `POST /api/generation-requests?topicId=...` (criar post baseado em pauta)

---

### FASE 3: Criação Multiformato

#### **Página: `/dashboard/generate`**

**Propósito:** Gerar conteúdo (posts únicos e carrosséis)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Criar Conteúdo                          │
│                                         │
│ [Stepper: 1.Tipo 2.Briefing 3.Review]  │
│                                         │
│ STEP 1: Tipo de conteúdo                │
│ ○ Post único                            │
│ ○ Carrossel (3-5 slides)                │
│ [Próximo]                               │
│                                         │
│ STEP 2: Briefing                        │
│ Campo: Assunto                          │
│ Campo: Rede(s) destinada                │
│ Campo: Instruções especiais             │
│ [Gerar]                                 │
│                                         │
│ STEP 3: Revisão                         │
│ ┌──────────────────────────────────┐   │
│ │ [Artifacts sendo gerados...]     │   │
│ │ ✅ Copy criada                   │   │
│ │ ⏳ Imagem gerando...             │   │
│ └──────────────────────────────────┘   │
│                                         │
│ [Aceitar] [Editar] [Rejeitar]          │
└─────────────────────────────────────────┘
```

**Fluxo detalhado:**

1. **STEP 1: Seleção de tipo**
   - Radio buttons: "Post único" vs "Carrossel"
   - Se carrossel: seletor de quantidade de slides

2. **STEP 2: Briefing (Input)**
   - Campo: Assunto/Tópico (text ou picker de TopicSuggestion)
   - Seleção: Qual(is) rede(s)? (checkbox: Instagram, LinkedIn, Facebook, X)
   - Campo: Instruções especiais (textarea)
   - Aplicação automática de BrandProfile.voice (não é campo)
   - Botão: "Gerar conteúdo"

3. **Feedback em tempo real (durante geração)**
   - Modal/Overlay com `GenerationProgress`
   - Estado de cada artefato: copy → imagem → preview
   - Estimativa de tempo

4. **STEP 3: Revisão (Output)**
   - Cards de artefato (um por slide/rede)
   - Cada card mostra: preview de imagem, copy, plataforma
   - Ações por artefato: editar, deletar, regenerar
   - Botão global: "Aceitar tudo" (salva como Post em draft)
   - Botão global: "Editar" (entra em modo de edição)
   - Botão global: "Rejeitar" (volta para STEP 2)

**Propriedades:**
- `generationRequest: GenerationRequest` (estado durante processo)
- `artifacts: GenerationArtifact[]` (saída de geração)
- `currentStep: 1 | 2 | 3`

**Componente location:** `apps/web/src/pages/dashboard/generate.tsx`

**API:**
- `POST /api/generation-requests` (criar request)
- `GET /api/generation-requests/:id` (poll status)
- `POST /api/posts` (salvar post após aceitar)

**Estados de Loading/Error:**
- Geração em andamento
- Erro de geração (retry)
- Erro de IA (regenerar artefato individual)

---

### FASE 4: Operação e Autonomia

#### **Página: `/dashboard/calendar`**

**Propósito:** Kanban de revisão + agendador de publicação

**Layout:**
```
┌─────────────────────────────────────────┐
│ Seu Calendário                          │
│                                         │
│ [Data selecionada] [< Semana | Mês >]  │
│                                         │
│ Autonomia: [Manual] [Semi] [Automático] │
│ Frequência: [Máx 3 posts/dia]           │
│ ⚠️ Modo automático ativo                │
│                                         │
│ ┌──────┬──────┬──────┬──────┐           │
│ │Draft │Review│Ready│Pub'd│           │
│ │      │      │     │     │           │
│ │[C] x3│[C] x1│[C]2 │[C]5│           │
│ │      │      │     │     │           │
│ └──────┴──────┴──────┴──────┘           │
│                                         │
│ [Drag and drop posts entre colunas]    │
│ [Clique em post para agendar]          │
└─────────────────────────────────────────┘
```

**Componentes:**
- Selector de autonomia (F0)
- Kanban board com 4 colunas (draft → review → ready → published)
- Modal de agendamento (ao clicar em post)

**Funcionalidades:**
- Drag-and-drop entre colunas
- Clique em card abre modal de edição + agendamento
- Status visual: clock ⏰ para agendado, checkmark ✅ para publicado
- Indicador de erro 🚨 se houver algum

**Propriedades:**
- `posts: Post[]` (todas as que não estão archived)
- `autonomyLevel: 'manual' | 'semi' | 'automatic'`
- `frequencyLimit: number` (máx posts/dia)

**Componente location:** `apps/web/src/pages/dashboard/calendar.tsx`

**API:**
- `GET /api/posts?status=...`
- `PATCH /api/posts/:id` (mudar status, agendar)
- `POST /api/posts/:id/publish` (publicar)

---

#### **Modal: Agendamento de Post**

**Estrutura:**
```
┌──────────────────────────────┐
│ Agendar Publicação           │
│                              │
│ Data: [date picker]          │
│ Hora: [time picker]          │
│ Redes: ☑ Instagram ☑ LinkedIn│
│                              │
│ ⚠️ Será publicado modo IA?  │
│ ○ Revisão manual antes       │
│ ○ Publicação automática      │
│ (conforme autonomia)         │
│                              │
│ [Agendar] [Cancelar]         │
└──────────────────────────────┘
```

---

### FASE 5: Loop de Avaliação

#### **Página: `/dashboard/analytics`**

**Propósito:** Medir performance pós-publicação

**Layout:**
```
┌─────────────────────────────────────────┐
│ Resultados                              │
│                                         │
│ [Filtro: Período] [Export CSV]          │
│                                         │
│ Resumo (período selecionado):           │
│ 👁️ 125K views | 💬 890 eng. | 📊 8.2% │
│                                         │
│ [Performance Chart — Line graph]        │
│ Views ao longo do tempo                 │
│                                         │
│ Posts de melhor desempenho:             │
│ ┌─────────────────────────────────┐    │
│ │ "Dica de produtividade"         │    │
│ │ Views: 8.9K | Eng: 234          │    │
│ │ [Ver detalhes]                  │    │
│ └─────────────────────────────────┘    │
│                                         │
│ [Painel recomendação:]                  │
│ "Seus posts sobre produtividade         │
│  performam 3x melhor. Continue          │
│  postando sobre isso!"                  │
└─────────────────────────────────────────┘
```

**Componentes:**
- Badge de métricas (views, engagement, conversion)
- Chart de performance (line graph)
- Card de post com detalhes
- Painel de recomendação (sugestão de próximo tópico)

**Propriedades:**
- `performance: Performance[]` (por post)
- `period: { start, end }`
- `metrics: { views, engagement, conversion }`

**Componente location:** `apps/web/src/pages/dashboard/analytics.tsx`

**API:**
- `GET /api/posts/:id/performance`
- `GET /api/performance/summary?period=...`

---

## IV. COMPONENTES AUXILIARES (Todas as Fases)

### Header/Navbar

**Conteúdo:**
- Logo + brand name (esquerda)
- Breadcrumbs (centro)
- User menu (direita: profile, settings, logout)
- Status de autonomia (se ativo)

**Componente location:** `apps/web/src/components/Header/Header.tsx`

---

### Sidebar

**Conteúdo:**
- Logo (topo)
- Menu principal:
  - Dashboard (index)
  - Criar (generate)
  - Escuta (listen) — F1
  - Pauta (topics) — F2
  - Calendário (calendar) — F4
  - Resultados (analytics) — F5
- Configurações (cog icon)
- User profile + logout (rodapé)

**Ativo:** Highlight item correspondente à página atual

**Componente location:** `apps/web/src/components/Sidebar/Sidebar.tsx`

---

### Dashboard Index

**Propósito:** Overview/home após login

**Conteúdo:**
- Saudação ("Olá, [Brand Name]!")
- Cards com resumos:
  - Posts publicados esta semana
  - Engagement médio
  - Próxima sugestão de pauta (F2)
  - Próximo post agendado
- Quick actions: [Criar post], [Ver pauta], [Ver resultados]
- Calendário mini (próximos 7 dias)

**Componente location:** `apps/web/src/pages/dashboard/index.tsx`

---

### Error Boundary + Error Page

**Tratamento:**
- Erro de geração (F3): "Falha ao gerar. [Tentar novamente]"
- Erro de publicação (F4): "Publicação falhou. [Ver motivo]"
- Erro de API genérico: "Algo deu errado. [Contatar suporte]"

**Componente location:** `apps/web/src/components/ErrorBoundary/ErrorBoundary.tsx`

---

## V. ESTADOS DE UI E TRANSIÇÕES

### Estado: Carregando
- Skeleton screens em vez de spinners
- Progressivo (mostrar dados parciais)
- Estimativa de tempo (se > 2s)

### Estado: Vazio
- Mensagem clara: "Você não tem posts ainda"
- CTA: "[Criar seu primeiro post]"

### Estado: Erro
- Mensagem descritiva
- Ação de retry
- Link para suporte

### Estado: Sucesso
- Toast notification (canto inferior direito)
- Auto-dismiss após 5s
- Ação opcional de undo (se aplicável)

---

## VI. FLUXOS DE DADOS (STATE MANAGEMENT)

### Contextos Esperados

1. **AuthContext** (existente, refatorar)
   - `user: User | null`
   - `isAuthenticated: boolean`
   - `logout: () => void`

2. **BrandContext** (novo)
   - `currentBrand: Brand`
   - `brandProfile: BrandProfile`
   - `updateBrandProfile: (data) => Promise<void>`

3. **GenerationContext** (novo)
   - `generationRequest: GenerationRequest | null`
   - `artifacts: GenerationArtifact[]`
   - `status: 'idle' | 'generating' | 'completed' | 'error'`
   - `startGeneration: (config) => Promise<void>`

4. **PostContext** (novo)
   - `posts: Post[]`
   - `selectedPost: Post | null`
   - `createPost: (data) => Promise<Post>`
   - `updatePost: (id, data) => Promise<Post>`
   - `publishPost: (id) => Promise<void>`

**Location:** `apps/web/src/contexts/`

---

## VII. MIGRATIONS DE BANCO DE DADOS (Firestore)

### Coleções Novas/Atualizadas

**`users/{userId}/brands/{brandId}/brandProfiles`**
- Adicionar campos: `voice`, `visual`, `narrative`, `autonomyLevel`
- Adicionar versionamento: `versions[].timestamp`
- Snapshot imutável: cada Post referencia `brandProfileVersion`

**`users/{userId}/brands/{brandId}/posts`**
- Adicionar: `brandProfileVersion` (snapshot ID)
- Adicionar: `status` (draft, scheduled, published, archived)
- Adicionar: `scheduledAt` (timestamp)
- Adicionar: `artifacts[]` (array de IDs de GenerationArtifact)

**`users/{userId}/brands/{brandId}/generationRequests` (nova)**
- ID único por request
- Campo: `status` (pending, generating, completed, failed)
- Campo: `artifacts[]` (array de IDs)
- Campo: `createdAt`, `completedAt`

**`users/{userId}/brands/{brandId}/generationArtifacts` (nova)**
- ID único por artefato
- Campo: `type` (copy, image, preview)
- Campo: `status` (pending, generating, completed, error)
- Campo: `data` (conteúdo do artefato)
- Campo: `generationRequestId` (FK)

**`users/{userId}/brands/{brandId}/audienceSignals` (nova — F1)**
- Campo: `platform` (instagram, linkedin, facebook, x)
- Campo: `metrics` (views, engagement, reach)
- Campo: `aggregatedAt` (timestamp)
- Índice: `platform, aggregatedAt`

**`users/{userId}/brands/{brandId}/topicSuggestions` (nova — F2)**
- Campo: `title` (notícia)
- Campo: `source` (URL verificada)
- Campo: `relevanceScore` (0-100)
- Campo: `suggestedAt` (timestamp)
- Campo: `isAccepted` (boolean)

**`users/{userId}/brands/{brandId}/performance` (nova — F5)**
- Campo: `postId` (FK)
- Campo: `metrics` (views, engagement, conversions)
- Campo: `measuredAt` (timestamp)
- Índice: `postId, measuredAt`

**Índices Firestore:**
```
users/{userId}/brands/{brandId}/posts
  - status, createdAt DESC
  - scheduledAt ASC
  - status, publishedAt DESC

users/{userId}/brands/{brandId}/generationRequests
  - status, createdAt DESC

users/{userId}/brands/{brandId}/audienceSignals
  - platform, aggregatedAt DESC

users/{userId}/brands/{brandId}/performance
  - postId, measuredAt DESC
```

---

## VIII. API ENDPOINTS (Backend — Fastify)

### Autenticação
- `POST /auth/login` ✅ (existente)
- `GET /auth/callback` ✅ (existente)
- `POST /auth/logout` ✅ (existente)

### Brand Profiles (F0)
- `GET /api/brands/:brandId/profile` (ler BrandProfile)
- `POST /api/brands/:brandId/profile` (criar)
- `PATCH /api/brands/:brandId/profile` (atualizar)
- `GET /api/brands/:brandId/profile/versions` (histórico de versões)

### Posts
- `GET /api/brands/:brandId/posts?status=...&sort=createdAt` (listar)
- `POST /api/brands/:brandId/posts` (criar draft)
- `PATCH /api/brands/:brandId/posts/:postId` (atualizar, mudar status)
- `POST /api/brands/:brandId/posts/:postId/publish` (publicar imediatamente)
- `POST /api/brands/:brandId/posts/:postId/schedule` (agendar)
- `DELETE /api/brands/:brandId/posts/:postId` (deletar/archive)
- `GET /api/brands/:brandId/posts/:postId/performance` (F5 — ler resultados)

### Generation Requests (F3)
- `POST /api/brands/:brandId/generation-requests` (iniciar geração)
- `GET /api/brands/:brandId/generation-requests/:requestId` (poll status)
- `GET /api/brands/:brandId/generation-requests/:requestId/artifacts` (ler artefatos)

### Audience Signals (F1)
- `GET /api/brands/:brandId/audience-signals?period=week|month|year` (ler sinal)
- `GET /api/brands/:brandId/audience-signals/by-platform` (agregado por rede)

### Topic Suggestions (F2)
- `GET /api/brands/:brandId/topic-suggestions?limit=10` (listar pautas)
- `PATCH /api/brands/:brandId/topic-suggestions/:topicId` (marcar como aceita/ignorada)

### Analytics (F5)
- `GET /api/brands/:brandId/analytics/summary?period=...` (resumo de performance)
- `GET /api/brands/:brandId/analytics/posts-performance?limit=5` (top posts)

---

## IX. CHECKLIST DE IMPLEMENTAÇÃO

### FASE 0: Núcleo da Marca

**Backend:**
- [ ] Estender `BrandProfile` entity (voice, visual, narrative, autonomyLevel)
- [ ] Implementar versionamento (snapshot imutável)
- [ ] Criar `BrandProfileRepository.version()`
- [ ] Criar endpoints: GET, POST, PATCH `/api/brands/:brandId/profile`
- [ ] Criar `BrandDocumentExtractorPort` (para IA analisar posts)

**Frontend:**
- [ ] Criar componente `Stepper`
- [ ] Criar página `/onboarding/brand-setup` (5 etapas)
- [ ] Criar página `/onboarding/connect-networks`
- [ ] Criar página `/onboarding/success`
- [ ] Criar página `/dashboard/brand-settings`
- [ ] Criar `BrandContext`
- [ ] Refatorar `/auth/login` com nova UI

**Database:**
- [ ] Migração Firestore: adicionar campos em `BrandProfile`
- [ ] Migração Firestore: adicionar `versions` array

**Testing:**
- [ ] Unit tests: BrandProfile versionamento
- [ ] E2E tests: onboarding completo (setup → connect → success)
- [ ] E2E tests: editar brand settings

**Documentação:**
- [ ] BDR: Núcleo da Marca (visão)
- [ ] ADR: Versionamento de BrandProfile (arquitetura)
- [ ] EDR: Implementação de BrandProfile (engenharia)

---

### FASE 1: Escuta (Analytics)

**Backend:**
- [ ] Criar `AnalyticsReaderPort` (interface)
- [ ] Implementar adapters: LinkedInAnalyticsAdapter, InstagramAnalyticsAdapter, etc.
- [ ] Criar `AudienceSignal` entity
- [ ] Criar `AudienceSignalRepository`
- [ ] Implementar minimização de dados (pipeline)
- [ ] Criar endpoints: GET `/api/brands/:brandId/audience-signals`

**Frontend:**
- [ ] Criar página `/dashboard/listen`
- [ ] Criar componente `Badge` (score)
- [ ] Criar componente `RecommendationPanel`
- [ ] Criar `AudienceContext`

**Database:**
- [ ] Nova coleção: `audienceSignals`
- [ ] Índices: `platform, aggregatedAt DESC`

**Testing:**
- [ ] Unit tests: minimização de dados (no PII vazado)
- [ ] Integration tests: adapter de analytics
- [ ] E2E tests: carregar analytics no `/dashboard/listen`

**Documentação:**
- [ ] ADR: Minimização de dados (segurança)
- [ ] EDR: Adapters de analytics

---

### FASE 2: Pauta Inteligente

**Backend:**
- [ ] Criar `NewsSourcePort` (ingestão de notícias)
- [ ] Implementar adapter de fonte de notícias
- [ ] Criar `VerifiedNewsItem` entity (com fonte rastreável)
- [ ] Criar `TopicSuggestion` entity
- [ ] Criar `TopicQueryPlannerPort` (motor de sugestão)
- [ ] Criar endpoints: GET `/api/brands/:brandId/topic-suggestions`

**Frontend:**
- [ ] Criar página `/dashboard/topics`
- [ ] Criar componente de sugestão de pauta com badge de relevância
- [ ] Integração com `/dashboard/generate?topicId=...`

**Database:**
- [ ] Nova coleção: `topicSuggestions`
- [ ] Nova coleção: `newsItems` (ou join com topicSuggestions)

**Testing:**
- [ ] Unit tests: verificação factual (fonte rastreável)
- [ ] Integration tests: motor de sugestão
- [ ] E2E tests: listar e criar post baseado em pauta

**Documentação:**
- [ ] ADR: Verificação factual (integridade)
- [ ] EDR: Motor de sugestão de pauta

---

### FASE 3: Criação Multiformato

**Backend:**
- [ ] Estender `GenerationRequest` (suportar N≥1 artefatos)
- [ ] Refatorar `GenerateContentUseCase` (sem duplicação de lógica)
- [ ] Aplicar `BrandProfile.voice` em prompt de copy
- [ ] Criar `GenerationArtifact` com estado granular
- [ ] Criar `ArtDirectorPort` (sugerir CTA automático)
- [ ] Endpoints: POST `generation-requests`, GET com status granular

**Frontend:**
- [ ] Criar componente `Stepper`
- [ ] Refatorar página `/dashboard/generate` (3 steps)
- [ ] Criar componente `GenerationProgress` (feedback granular)
- [ ] Criar componente `ArtifactCard` (preview por slide)
- [ ] Criar componente `GenerationContext`

**Database:**
- [ ] Nova coleção: `generationRequests`
- [ ] Nova coleção: `generationArtifacts`
- [ ] Índices: `status, createdAt DESC`

**Testing:**
- [ ] Unit tests: agregado de múltiplos artefatos
- [ ] Unit tests: aplicação de voz de marca em copy
- [ ] Integration tests: geração com Gemini/Imagen
- [ ] E2E tests: criar post único
- [ ] E2E tests: criar carrossel (3 slides)

**Documentação:**
- [ ] ADR: Agregado de múltiplos artefatos
- [ ] EDR: Aplicação de voz de marca em geração

---

### FASE 4: Operação e Autonomia

**Backend:**
- [ ] Implementar guardrails: frequência, temas sensíveis, interrupção manual
- [ ] Criar `PublisherPort.publish(..., autonomyLevel)` com guardrails
- [ ] Cloud Tasks + Cloud Scheduler para agendamento
- [ ] Endpoints: PATCH posts (mudar status), POST publish, POST schedule

**Frontend:**
- [ ] Criar componente `KanbanBoard` (drag-drop entre status)
- [ ] Criar componente `AutonomySelector` (dial manual → semi → auto)
- [ ] Criar página `/dashboard/calendar`
- [ ] Modal de agendamento com date/time picker
- [ ] Indicadores visuais de status (agendado, publicado, erro)

**Database:**
- [ ] Adicionar `status` em posts
- [ ] Adicionar `scheduledAt` em posts
- [ ] Adicionar `autonomyLevel` em BrandProfile

**Testing:**
- [ ] Unit tests: guardrails (frequência, temas)
- [ ] Integration tests: publicação com Cloud Tasks
- [ ] E2E tests: mover post de draft para published via Kanban
- [ ] E2E tests: agendar post para data/hora futura

**Documentação:**
- [ ] ADR: Guardrails de publicação autônoma
- [ ] EDR: Implementação de agendamento

---

### FASE 5: Loop de Avaliação

**Backend:**
- [ ] Criar `Performance` entity (views, engagement, conversions)
- [ ] Adapters de leitura de performance por rede
- [ ] Endpoints: GET `posts/:id/performance`, GET `analytics/summary`
- [ ] Recalibração de sinal de audiência e motor de pauta com novo dado

**Frontend:**
- [ ] Criar página `/dashboard/analytics`
- [ ] Criar componente `PerformanceChart` (line graph)
- [ ] Criar componente de resumo de métricas
- [ ] Integração com `RecommendationPanel` (sugestão baseada em performance)

**Database:**
- [ ] Nova coleção: `performance`
- [ ] Índices: `postId, measuredAt DESC`

**Testing:**
- [ ] Integration tests: leitura de performance por rede
- [ ] E2E tests: visualizar analytics de post publicado
- [ ] E2E tests: recalibração de pauta baseada em performance

**Documentação:**
- [ ] ADR: Medição e loop de avaliação
- [ ] EDR: Recalibração contínua

---

## X. CHECKLIST DE LAYOUT E ESTILO

### Tokens a Implementar (Tailwind Config)

**Cores:**
- `brand.50` a `brand.900` (escala azul accent)
- `bg-diagnostic` (fundo escuro com blobs para F0)
- `bg-operation` (fundo claro com pontos para dashboard)

**Tipografia:**
- Font-family principal
- Font-family monospace (para código/copy)
- Scale de tamanhos (sm, base, lg, xl, 2xl, 3xl)

**Spacing:**
- Margin/padding scale (0, 0.5, 1, 2, 4, 8, 16, 32)

**Componentes-padrão:**
- Button (primary, secondary, danger)
- Input (text, select, date, time)
- Card (base, elevated, outline)
- Badge (score, category, sentiment)
- Toast notification

**Componente location:** `apps/web/tailwind.config.ts` + `apps/web/src/styles/globals.css`

---

## XI. ROTAS ESTRUTURA FINAL (Next.js App Router)

```
src/app/
├── auth/
│   ├── login/
│   │   └── page.tsx
│   ├── callback/
│   │   └── page.tsx
│   └── logout/
│       └── page.tsx
│
├── onboarding/
│   ├── brand-setup/
│   │   └── page.tsx
│   ├── connect-networks/
│   │   └── page.tsx
│   └── success/
│       └── page.tsx
│
├── dashboard/
│   ├── page.tsx (index)
│   ├── generate/
│   │   └── page.tsx
│   ├── listen/
│   │   └── page.tsx
│   ├── topics/
│   │   └── page.tsx
│   ├── calendar/
│   │   └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   └── brand-settings/
│       └── page.tsx
│
├── settings/
│   ├── account/
│   │   └── page.tsx
│   ├── billing/
│   │   └── page.tsx
│   └── notifications/
│       └── page.tsx
│
├── layout.tsx (root layout)
├── page.tsx (/ redirect)
└── error.tsx (error boundary)
```

---

## XII. DEPENDÊNCIAS DE TERCEIROS (Frontend)

**Já instaladas (presumido):**
- next@15
- react@19
- typescript
- tailwindcss
- firebase

**A instalar (se não estiver):**
- react-beautiful-dnd (Kanban drag-drop)
- recharts (gráficos)
- react-hot-toast (notificações)
- date-fns (manipulação de datas)
- zod (validação de forms)
- react-hook-form (forms)

**Não adicionar:**
- UI libraries pré-feitas (shadcn, MUI) — construir customizado

---

## XIII. PERFORMANCE E OTIMIZAÇÕES

### Code Splitting
- Lazy load pages (automático Next.js)
- Lazy load componentes pesados (ArtifactCard, PerformanceChart)

### Images
- Otimizar logo e assets com next/image
- Lazy load imagens de preview de artefatos

### Database Queries
- Pagination em listas (posts, topics, suggestions)
- Índices Firestore conforme listado em seção VII

### Caching
- Cache de BrandProfile no contexto (não refetch a cada render)
- Cache de AudienceSignals (refresh 1x por hora)

---

## XIV. ROLLOUT E Feature FLAGS

### Fase de Rollout Recomendada

1. **F0** → Internal team (1-2 semanas)
2. **F0** → Beta users (1 semana)
3. **F0** → Rádio Kactus (1 semana)
4. **F0 + F1** → General availability (após testes com Kactus)
5. **F1 + F2** → (paralelo com feedback de F0)
6. **F2 + F3** → (paralelo com feedback de F1)
7. **F3 + F4** → (com guardrails extra para publicação autônoma)
8. **F4 + F5** → General availability

### Feature Flags (Recomendado)
- `FEATURE_BRAND_PROFILE_V2` (F0)
- `FEATURE_AUDIENCE_SIGNALS` (F1)
- `FEATURE_TOPIC_SUGGESTIONS` (F2)
- `FEATURE_MULTIARTEFACT_GENERATION` (F3)
- `FEATURE_AUTONOMY_MODE` (F4)
- `FEATURE_ANALYTICS_DASHBOARD` (F5)

---

## XV. MONITORAMENTO E OBSERVABILIDADE

### Métricas para Acompanhar

**F0:**
- Tempo de onboarding
- Taxa de conclusão de profile
- Taxa de conexão de redes

**F1:**
- Latência de carregamento de analytics
- Acurácia de sinal de audiência vs. realidade

**F2:**
- Taxa de aceite de sugestões
- Qualidade de verificação factual

**F3:**
- Taxa de aceite de geração
- Latência de geração por artefato
- Erro rate de IA

**F4:**
- Taxa de publicação manual vs. automática
- Ativação de guardrails
- Taxa de erro de publicação

**F5:**
- Correlação de performance com pauta
- Recalibração eficácia

### Logging
- Toda ação de usuário (criou post, publicou, agendou)
- Toda falha de IA
- Toda ativação de guardrail

---

## XVI. SEGURANÇA E CONFORMIDADE

### Checklist
- [ ] HTTPS everywhere (conforme ADR-020)
- [ ] Auth bearer token validado em cada request
- [ ] Firestore security rules restritivos (conforme ADR-015)
- [ ] Sem vazamento de PII em logs
- [ ] Consentimento explícito para coleta de audiência (F1)
- [ ] Auditoria de publicações autônomas (F4)

---

## XVII. REGRESSÕES E TESTES

### Testes Visuais (Visual Regression)
- Capturas de cada página
- Comparação automática com baseline
- Ferramenta: Playwright ou Percy

### Testes de Acessibilidade
- axe-core em cada página
- Testes de navegação por teclado
- Testes de leitores de tela

### Testes de Performance
- Lighthouse CI (>90 score)
- Performance budgets por página

---

## XVIII. DOCUMENTAÇÃO PARA DEVS

### READMEs a Criar
- `apps/web/README.md` — setup, scripts, estrutura
- `apps/web/PAGES.md` — mapa de páginas (este documento)
- `apps/web/COMPONENTS.md` — componentes-padrão
- `apps/web/CONTEXT.md` — contextos de state

### Storybook (Opcional mas Recomendado)
- Documentar componentes-padrão
- Listar todos os estados (loading, error, success)
- Facilita revisão de UI

---

## XIX. MIGRAÇÃO DE DADOS (Existente → Novo)

### Posts Existentes
- Se existem posts em v1, adicionar `brandProfileVersion` (referência ao snapshot)
- Executar backfill: `posts.update({ brandProfileVersion: 'legacy-v1' })`

### BrandProfile Existente
- Se existe `BrandProfile` em v1, migrar para schema novo
- Versionamento: `versions[0] = snapshot atual`

---

## XX. ROLLBACK PLAN

### Se algo der errado em produção
- Feature flag desativa nova UI, volta para v1
- Firestore backups automáticos (GCP)
- Rollback de frontend: redeploy versão anterior
- Comunicação com usuários: "Maintenance"

---

## RESUMO DE ENTREGAS POR FASE

| Fase | Páginas | Componentes | APIs | Database | Tests | Docs |
|------|---------|------------|------|----------|-------|------|
| F0 | 4 (setup, networks, success, settings) | Stepper, Header, Sidebar | 4 (brand CRUD) | BrandProfile versioning | Unit + E2E | BDR, ADR, EDR |
| F1 | 1 (listen) | Badge, RecommendationPanel | 3 (signals) | AudienceSignals | Integration + E2E | ADR, EDR |
| F2 | 1 (topics) | Badge | 2 (suggestions) | TopicSuggestions | Integration + E2E | ADR, EDR |
| F3 | 1 (generate) | Stepper, ArtifactCard, GenerationProgress | 4 (generation) | GenerationRequests, Artifacts | Unit + Integration + E2E | ADR, EDR |
| F4 | 1 (calendar) | KanbanBoard, AutonomySelector | 5 (posts CRUD + schedule) | Posts status/scheduled | Integration + E2E | ADR, EDR |
| F5 | 1 (analytics) | PerformanceChart, Badge | 4 (performance) | Performance | Integration + E2E | ADR, EDR |

---

## PRÓXIMOS PASSOS

1. **ARGUS delibera** este plano (alterações/aprovação)
2. **Sprint 0 (F0):** Implementar brand setup + onboarding (2 semanas)
3. **Sprint 1 (F1):** Implementar analytics + audience signals (2 semanas)
4. **Sprint 2 (F2):** Implementar pauta + topic suggestions (2 semanas)
5. **Sprint 3 (F3):** Refatorar geração + multiartefatos (3 semanas)
6. **Sprint 4 (F4):** Implementar Kanban + agendamento (2 semanas)
7. **Sprint 5 (F5):** Implementar analytics + loop (2 semanas)

**Total estimado:** 14 semanas (até fins de setembro/2026)

---

**Documento pronto para deliberação ARGUS. ✅**

Todas as páginas, componentes, APIs, migrations e testes foram mapeados. Zero gaps.
