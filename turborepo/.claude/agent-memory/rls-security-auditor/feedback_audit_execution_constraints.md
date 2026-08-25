---
name: feedback-audit-execution-constraints
description: Jak weryfikować wykonaniem jako rls-security-auditor — zakaz zapisu plików, technika symulacji przepływu przez tsx --eval, sprawdzanie czy test w ogóle rozróżnia poprawkę
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
- `npx tsx --eval "..."` — importuje TypeScript wprost z
  `packages/contracts/src/generated/*.ts`. Tym sprawdzisz realne `can(role, resource, cap)`
  zamiast czytać macierz. Michal poprosił o tę metodę **imiennie** w drugiej rundzie audytu
  („tak jak w pierwszym audycie") — to zwalidowane podejście, stosuj je domyślnie.
- **Symulacja przepływu sterowania inline.** Gdy bramka autoryzacyjna to czysta funkcja
  (rola z sesji + `can()` + porównanie właścicielstwa), przepisz ten `if` do `tsx --eval`,
  zaimportuj PRAWDZIWE `can()` i przepuść przez to obie wersje: „przed poprawką" i „po".
  To daje dowód wykonaniem bez pliku testowego. Zawsze podaj fixture ataku (np. wspólna
  skrzynka firmowa: `findUnique` po e-mailu ZWRACA rekord).
- `npx vitest run <istniejący plik testowy>` — testy, które JUŻ są w repo.
- `npx tsc --noEmit -p apps/b2b-web/tsconfig.json` — dowodzi, że klient Prisma ma pola,
  których używa audytowany kod.
- `node tools/kk-validate.mjs`, `node tools/kk-codegen.mjs --check`.

**Zielony test ≠ dowód poprawki.** Zanim uznasz, że test pokrywa znalezisko, sprawdź, czy on
w ogóle ROZRÓŻNIA wersję podatną od naprawionej. W tym repo testy mockują Prismę przez
`vi.fn()` + `mockReset()` w `beforeEach`, więc niezadeklarowany `findUnique` zwraca
`undefined` i akcja odpada na „cudzy rekord" — test przechodzi także na kodzie podatnym
(tzw. vacuous pass). Zespół zna już ten problem pod nazwą BLOCKER 2 / „vacuous truth"
w `availability-self-declaration.test.ts`.

Czego NIE da się wykonać: zapytań SQL — w tym środowisku nie ma `docker`, `psql` ani
`supabase` CLI, więc nie ma lokalnej instancji do odpytania jako konkretna rola. Napisz to
w werdykcie zamiast udawać, że polityka została sprawdzona. Patrz [[project-rls-baseline-landed]].
