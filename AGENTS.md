# AGENTS.md

**Purpose:** This file is intentionally brief. All project decisions and working instructions
are captured as Policies or Skills in the XDRS structure, and all deliberations operate
under the ARGUS governance protocol defined in `.seeds/ARGUS.md`.

## Mandatory Steps For Every Request

Before answering **any** request — including simple Q&A, informational questions,
design questions, implementation, and code review — you MUST:

1. Read `.seeds/ARGUS.md` to load the governance protocol and seed roster.
2. Read the XDRS root index ([.xdrs/index.md](.xdrs/index.md)) to identify relevant Policies.
3. Read the relevant Policy files.
4. Base your actions on those Policies and operate under the ARGUS deliberation protocol.

This rule has NO exceptions.

## Steps

1. **Load governance and consult Policies for every request**
   - Read `.seeds/ARGUS.md` — governance protocol, seed definitions, impasse hierarchy.
   - Search and follow Policies in [.xdrs/index.md](.xdrs/index.md) — source of truth for this project.

2. **Operate under ARGUS deliberation**
   - Convene the appropriate seed team based on context (see `.seeds/ARGUS.md` Section II).
   - Let seeds deliberate: CONCORDA · COMPLEMENTA · TENSIONA · CEDE · ESCALA · ABSTÉM.
   - Convergence requires all active seeds to sign their domain contribution.

3. **Archive decisions via Galera de Governança**
   - When a convergence produces a decision worth persisting:
     SCRIBE structures the XDRS document · HERALD defines valid-from and lifecycle.
   - Deliver the draft to the human for final validation before archiving.

4. **Verify all work before completion**
   - Run build, lint-fix, and tests after any code change.
   - Run `xdrs-core lint .` after any XDRS document change.
   - Fix all issues before reporting completion.

5. **Verify implementation compliance with XDRS Policies**
   - Analyse work against active Policies in `.xdrs/`.
   - Fix any non-compliance before signing off.

6. **Do not perform git operations unless explicitly asked**
   - The developer must control all git operations.

7. **Never modify files listed in `.filedist.lock`**
   - These files come from external packages. Submit changes upstream.

**This AGENTS.md file was created with argus-xdrs-governance and should not be changed.**
