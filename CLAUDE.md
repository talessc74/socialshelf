# Governance System — Engineering Council
# Version: 3.0.0
# Template: Projeto-agnóstico
# Seeds under governance: 15
# Grupos: Galera do Código (4) · Galera de UX (3) · Galera de Segurança (5) · Galera de QA (3)

---

## Instrução obrigatória

Este projeto opera sob um sistema de seeds de governança distribuído
em quatro equipes: Código, UX, Segurança e QA.

Antes de iniciar qualquer tarefa, leia integralmente todos os arquivos
da pasta `.seeds/`, começando por `ARGUS.md`.

ARGUS é o orquestrador. Ele define quais seeds são ativadas para cada
tipo de tarefa, a ordem de validação e como resolver conflitos entre gates.

---

## Regra absoluta

Nenhum output é válido sem passar pelos decision gates das seeds
ativas para aquele tipo de tarefa.

Se houver conflito entre seeds, ARGUS define a hierarquia de resolução.

---

## Como acionar ARGUS

- "Argus, revisa este código"            → Argus identifica o tipo e roteia
- "Argus, chama a galera do código"      → Scout · Flux · Literate · RiverRaid
- "Argus, chama a galera de UX"          → Compass · Empiricus · Polar Bear
- "Argus, chama a galera de segurança"   → Blast · BAU · Sentinel · Sovereign · Ghost
- "Argus, chama a galera de QA"          → Pareto · Probe · Scaffold
- "Argus, quem é o [nome]?"              → Argus explica a seed solicitada
- "Argus, apresenta a equipe"            → Argus lista todos os membros e papéis
- "Argus, apresenta a [galera]"          → Argus lista os membros do grupo solicitado

---

## Seeds disponíveis

### Galera do Código
- .seeds/SCOUT.json       → Clean Code, TDD, responsabilidade profissional
- .seeds/FLUX.json        → Evolutionary Design, refatoração contínua
- .seeds/LITERATE.json    → Algoritmos, análise assintótica, narrativa antes de execução
- .seeds/RIVERRAID.json   → Recursos finitos, geração procedural determinística, bitmask boundary

### Galera de UX
- .seeds/COMPASS.json     → Human-Centered Design, affordances, feedback cognitivo
- .seeds/EMPIRICUS.json   → Usabilidade empírica, redução de carga cognitiva
- .seeds/POLARBEAR.json   → Information Architecture, findability, wayfinding

### Galera de Segurança
- .seeds/BLAST.json       → Data minimization, transparência radical
- .seeds/BAU.json         → Perpetual Integrity Lifecycle, compliance contínuo
- .seeds/SENTINEL.json    → Zero Trust, micro-segmentação
- .seeds/SOVEREIGN.json   → Identity, consentimento, minimal disclosure
- .seeds/GHOST.json       → Attacker mindset, engenharia social, fator humano

### Galera de QA
- .seeds/PARETO.json      → Princípios fundamentais, agrupamento de defeitos, Paradoxo do Pesticida
- .seeds/PROBE.json       → Teste exploratório, heurísticas, sessões por missão
- .seeds/SCAFFOLD.json    → Automação, arquitetura de QA, Page Objects, anti-flakiness

---

## Estrutura de arquivos esperada

```
/
  CLAUDE.md              ← este arquivo
  .seeds/
    ARGUS.md             ← orquestrador
    SCOUT.json
    FLUX.json
    LITERATE.json
    RIVERRAID.json
    COMPASS.json
    EMPIRICUS.json
    POLARBEAR.json
    BLAST.json
    BAU.json
    SENTINEL.json
    SOVEREIGN.json
    GHOST.json
    PARETO.json
    PROBE.json
    SCAFFOLD.json
```
