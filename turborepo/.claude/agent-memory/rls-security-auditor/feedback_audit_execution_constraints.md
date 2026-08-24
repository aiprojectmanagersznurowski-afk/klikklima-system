---
name: feedback-audit-execution-constraints
description: Jak weryfikować wykonaniem jako rola rls-security-auditor — hook blokuje KAŻDY zapis pliku, także do scratchpada
metadata:
  type: feedback
---

Weryfikuj wykonaniem, ale **nie twórz plików** — nawet w katalogu tymczasowym poza repo.
Hook `.claude/hooks/guard-paths.mjs` blokuje `Write` dla roli `rls-security-auditor` do
wszystkiego poza `.claude/agent-memory/`, łącznie ze scratchpadem sesji. Nie obchodź tego
zapisem przez `bash`.

**Why:** to jest bramka uprawnień, a nie niedogodność. Audytor bezpieczeństwa, który obchodzi
własny sandbox, żeby wygodniej pracować, unieważnia swój werdykt. Zakres zapisu roli to
świadoma decyzja projektu (tabela ról w CLAUDE.md: `rls-security-auditor` → „— (tylko odczyt)").

**How to apply:** co da się wykonać bez pliku:
- `npx tsx --eval "..."` — importuje TypeScript wprost, działa na
  `packages/contracts/src/generated/*.ts`. Tym sprawdzisz realne wyniki `can(role, resource, cap)`
  zamiast czytać macierz.
- `npx vitest run <istniejący plik testowy>` — uruchamia testy, które JUŻ są w repo.
- `npx tsc --noEmit -p apps/b2b-web/tsconfig.json` — dowodzi, że klient Prisma faktycznie ma
  pola, których używa audytowany kod (np. `availabilityDeclaration.upsert`, `include: { availability_declaration: true }`).
- `node tools/kk-validate.mjs`, `node tools/kk-codegen.mjs --check`.

Czego NIE da się wykonać: własnych testów-sond z mockami (vitest wymaga pliku) oraz zapytań SQL —
w tym środowisku nie ma `docker`, `psql` ani `supabase` CLI, więc nie ma lokalnej instancji.
Napisz to w werdykcie zamiast udawać, że polityka została sprawdzona. Patrz [[project-rls-state-not-in-vcs]].
