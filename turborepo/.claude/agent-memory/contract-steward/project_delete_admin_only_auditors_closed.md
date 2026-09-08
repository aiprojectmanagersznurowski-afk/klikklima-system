---
name: delete-admin-only-auditors-closed
description: CRM-DELETE-ADMIN-ONLY-AUDITORS ustawione na DONE 2026-09-08 — pierwszy wpis rodziny z ochroną przed DISABLE ROW LEVEL SECURITY; commit ZABLOKOWANY przez baseline nazewnictwa
metadata:
  type: project
---

`CRM-DELETE-ADMIN-ONLY-AUDITORS` → `status: 'DONE'` (2026-09-08). Wzorzec jak w `-LEADS` i `-CREWS`:
UI (`canDeleteAuditors`) i Server Action (`deleteAuditorAction`) były poprawne od dawna, brakowało
wyłącznie pokrycia testem. To NIE był przypadek `-INSTALLATIONS`, gdzie UI była realną luką —
sprawdziłem kod rodzeństwa zanim uwierzyłem w raport, zgodnie z [[delete-admin-only-installations-closed]].

**Co ten wpis wnosi ponad resztę rodziny:** `AC-AUDITORS-RLS.4` — asercja, że ŻADEN plik migracji nie
zawiera `ALTER TABLE audytorzy DISABLE ROW LEVEL SECURITY`. Bez niej poprawne polityki stają się martwym
zapisem po jednej przyszłej migracji, a testy 1-3 (whitelista polityk) tego nie widzą, bo patrzą tylko
na `CREATE POLICY`. Ta sama luka ZOSTAJE otwarta w `-LEADS`, `-INSTALLATIONS` i `-CREWS` (już DONE) —
świadomie odłożona, ewidencja w `.claude/agent-memory/test-author/project_rls_disable_debt_family.md`.

**Why:** rodzina `CRM-DELETE-ADMIN-ONLY-*` jest pisana z szablonu, więc dowód RLS też był kopiowany —
i razem z nim luka. Wzmocnienie jednego wpisu tworzy nierówność, którą trzeba jawnie odnotować,
inaczej przy następnym zamknięciu ktoś skopiuje słabszy wariant sprzed poprawki.

**How to apply:** zamykając `-SERVICES` albo `-INCIDENTS`, kopiuj wariant AUDITORS (4 asercje), nie
LEADS/CREWS (3). Weryfikację mutacyjną rób sam, wstrzykując mutanta jako OSOBNY plik `.sql`
w `supabase/migrations/` i kasując go zaraz po — dowodzi to przy okazji, że skan obejmuje cały katalog,
a nie tylko plik bazowy.

**STAN OTWARTY: commit nie przeszedł.** Praca jest zastage'owana (kontrakt + generated + 3 pliki testowe
+ pamięć), wszystkie bramki kontraktowe zielone (kk-validate, kk-selftest 43/43, kk-codegen --check,
kk-trace), ale `.githooks/pre-commit` zatrzymuje commit na `kk-naming.mjs --check-baseline`: +9 z mojego
`auditors-rls-deny-by-default.test.ts` i +9 z cudzego, niezacommitowanego `incidents-rls-deny-by-default.test.ts`.
Szczegóły i reguła „baseline aktualizuje człowiek": [[naming-baseline-on-migrations]].
