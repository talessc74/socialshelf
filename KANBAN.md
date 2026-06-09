# KANBAN — SocialShelf · Rádio Kactus

## Cards do Projeto

### Sprint 0 — Fundação
- ✅ Configurar repositório GitHub · Código
- ✅ Monorepo (pnpm workspaces + Turborepo) · Código
- ✅ TypeScript base config (packages/tsconfig) · Código
- ✅ Domain package — entidades + ports (arquitetura hexagonal) · Código
- ✅ api-service scaffold (Fastify + Vitest) · Código
- ✅ publisher-service scaffold (Fastify + Vitest) · Código
- ✅ generator-service scaffold (Fastify + Vitest + Gemini/Vertex AI) · Código
- ✅ Firebase config (firestore.rules + indexes) · Infra
- ✅ CI/CD — GitHub Actions (lint + type-check + test + docker build) · Infra
- ✅ Dockerfiles para Cloud Run (api, publisher, generator) · Infra
- ✅ Setup Firebase — projeto GCP real · Infra
- ✅ web scaffold (Next.js 15 + Tailwind) · UX
- ✅ Secret Manager API habilitado + credenciais locais via gcloud ADC · Infra
- 📋 Cloud Run — deploy inicial dos 3 serviços · Infra

### Sprint 1 — OAuth e Publicação
- ✅ OAuth LinkedIn — end-to-end funcionando (profile + w_member_social) · Código
- 🔄 OAuth X (Twitter) — código implementado, teste E2E pendente · Código
- ⏸️ OAuth Instagram / Facebook (Meta) — aguardando deploy (precisa de HTTPS real) · Código
- ✅ Publicação manual — composer UI (+ Novo Post) · UX
- 📋 Publicação real — testes E2E LinkedIn + X · Segurança
- 📋 Auditoria de segurança OAuth · Segurança

### Sprint 2a — Publicação Manual
- 📋 Composer de post — editor de conteúdo · UX
- 📋 Preview por plataforma · UX
- 📋 Publicação imediata · Código

### Sprint 2b — Geração de Conteúdo via IA
- 📋 Cloud Storage buckets + IAM · Infra
- 📋 EXIF strip middleware + upload · Código
- 📋 AI consent flow · Segurança
- 📋 GeminiAdapter (copy generation, Vertex AI) · Código
- 📋 ImagenAdapter (image generation, Vertex AI) · Código
- 📋 GenerateContentUseCase · Código
- 📋 Tela de briefing + tela de revisão · UX

### Sprint 3 — Agendamento e Métricas
- 📋 Agendamento de posts (Cloud Tasks + Scheduler) · Código
- 📋 Dashboard de métricas · UX
- 📋 Monitoramento e alertas · Infra

### Sprint 4 — Multi-produto e Lançamento
- 📋 Multi-produto — seletor de marca · UX
- 📋 Testes de usabilidade · UX
- 📋 EAI? — preparação de lançamento · Marketing
- 📋 Onboarding Rádio Kactus · Conselho
- 📋 Plano de conteúdo — semana 1 · Marketing
