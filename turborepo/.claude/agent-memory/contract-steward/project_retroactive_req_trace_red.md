---
name: retroactive-req-trace-red
description: Rejestracja wymagania po napisaniu testów zawsze zapala kk-trace na czerwono, bo contract-steward nie może dopisać @REQ w apps/**/tests/
metadata:
  type: project
---

Rejestracja wymagania RETROAKTYWNIE (testy napisane wcześniej, bez `@REQ`, bo ID jeszcze nie
istniało) zapala nowy czerwony krok w `scripts/verify.sh`: `kk-trace --enforce` wywala każde
wymaganie o statusie `IMPLEMENTING` lub `DONE`, które nie ma ani jednego testu
(`tools/kk-trace.mjs:103`). `TODO` i `BLOCKED` przez tę regułę przechodzą.

Domknięcia nie da się wykonać w jednej turze: `agentWriteScopes` w `tools/kk.config.mjs` nie
daje `contract-steward` dostępu do `apps/**/tests/` ani do katalogu scratchpad poza repo, więc
dopisanie siedmiu linii `// @REQ: <ID>` musi zrobić `test-author` w osobnej turze.

**Why:** SEC-AUTHZ-B2B-READS (2026-09-02) — `test-author` dostał instrukcję pisania testów bez
`@REQ`, bo wymaganie miało powstać dopiero w Fazie 4 WO. Efekt: ~90 przechodzących testów,
zerowe widoczne pokrycie i trzeci czerwony krok w bramce, którego przed moją zmianą nie było.

**How to apply:** Przy planowaniu WO, w którym rejestracja ID idzie PO testach, uprzedź, że
bramka zapali się na czerwono do czasu tagowania, i zaplanuj turę `test-author` jako ostatnią.
Nie gaś tego przestawieniem statusu na `TODO` — to obejście reguły przez fałszywy status,
dokładnie ten dryf, który opisuje [[requirement-status-drift]]. Status ma opisywać stan pracy,
nie kolor bramki.
