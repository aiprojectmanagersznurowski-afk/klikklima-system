---
name: feedback-no-react-hook-form-in-b2b
description: react-hook-form + zodResolver is mandated by CLAUDE.md but is not an installed dependency anywhere in this monorepo as of 2026-08-20
metadata:
  type: feedback
---

`apps/b2b-web` (and the rest of the repo) has zero usages of `react-hook-form` or `@hookform/resolvers` — confirmed via `grep -rl "react-hook-form"` across `apps/b2b-web/src` and `node_modules`/lockfile checks, all empty. The CLAUDE.md stack table lists RHF+zodResolver as the mandatory form stack, but no app actually has the dependency installed.

**Why:** Discovered while building the "Zwróć do obiegu" and "Archiwizuj (Lost)" dialogs in `apps/b2b-web/src/app/(dashboard)/leads/` (WO CRM-SAFE-RECORD-ACTIONS, GREEN 3/3). Installing a new dependency mid-feature as an `implementer-ui` turn (scoped to components only, no build tooling changes authorized) was out of scope, and no other component in the app demonstrates the intended RHF pattern to follow.

**How to apply:** Until someone (human or `contract-steward`-equivalent for tooling) actually adds `react-hook-form`/`@hookform/resolvers`/`zod` as deps to `apps/b2b-web`, don't block on the RHF mandate for small dialogs. Acceptable pragmatic substitute: a single `useState` holding one form-shaped object (not one `useState` per field — that part of the rule is still honored), manual validation before submit. Flag this gap in the turn's final report rather than silently picking a workaround; if a future WO explicitly requires a bigger form (many fields, complex validation), raise the RHF dependency gap as a blocking question before building it with ad hoc state.
