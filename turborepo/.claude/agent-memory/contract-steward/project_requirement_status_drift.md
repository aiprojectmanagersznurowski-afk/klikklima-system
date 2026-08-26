---
name: requirement-status-drift
description: Pole status w requirements.contract.mjs nie jest pilnowane przez żadną regułę bramki — wpis zamknięty implementacją i testami zostaje TODO, dopóki człowiek nie zleci poprawki
metadata:
  type: project
---

`status` we wpisach `R(...)` w `contracts/requirements.contract.mjs` jest deklaracją, nie faktem wyprowadzonym z repozytorium. Ani `kk-validate.mjs`, ani `kk-selftest.mjs`, ani `kk-codegen --check` nie porównują `status` z rzeczywistym pokryciem; `kk-trace.mjs` tylko *wypisuje* zadeklarowany status obok znalezionych testów, więc wpis z kompletem testów potrafi latami raportować `TODO`.

Skutki obserwowane 2026-08-26: `SEC-LEADS-LIST-MINIMIZE` miał zamkniętą implementację, testy i czysty REVIEW, a nadal `TODO` (poprawiony). `SEC-ASSIGNMENT-POOL-MINIMIZE` — podbicia ODMÓWIONO 2026-08-26 mimo wyraźnego polecenia człowieka: implementacja (commit `3f6ae35`) i 16 testów kształtu przechodzą, ale dwa z dwunastu kryteriów nie są spełnione co do litery i żaden test ich nie dowodzi. AC6 żąda typu zdefiniowanego RAZ przy zwrocie akcji i importowanego w konsumentach — `leads/actions.ts` nie eksportuje żadnego typu, a `assign-auditor.tsx` (`AssignableAuditor`) i `leads-client.tsx` (`AuditorPoolEntry`) mają ręczne kopie kształtu (tylko `assign-crew-dialog.tsx` robi to poprawnie przez `Awaited<ReturnType<typeof getCrews>>`). AC12 zakazuje rzutowania w optymistycznej aktualizacji audytora, a `as Lead` stoi tam nadal — jego usunięcie zostało zaksięgowane pod osobnym, wciąż otwartym `SEC-LEADS-LIST-SCALARS` (AC9).

**Pułapka dowodowa:** obecność testu przy ID w `kk-trace.mjs` nie znaczy, że test dowodzi każdego kryterium. Kryteria typologiczne (AC6) i te o kształcie kodu, a nie danych (AC12), nie są łapane przez testy kształtu ani przez `tsc` — ręczna kopia typu kompiluje się bez oporu. Przy podbijaniu statusu czytaj listę `acceptance` pozycja po pozycji i szukaj DOWODU, nie tematycznej zbieżności nazwy pliku testowego.

**Why:** statystyka pokrycia (`Razem: 26/91`) jest wejściem do planowania, a zaniżony licznik generuje pracę nad czymś, co jest już zrobione. Odwrotny błąd byłby groźniejszy — dlatego domyślnie NIE podbijamy statusu z własnej inicjatywy.

**How to apply:** zmiana `status` na `DONE` to zmiana kontraktu jak każda inna — wymaga otwartego okna i pełnej procedury, ale jest zmianą minimalną (jedno słowo, `replace_all: false`, string zakotwiczony w ID wymagania, bo opisy wpisów zawierają dużo powtarzalnego tekstu). Podbicia dokonuj wyłącznie na wyraźne polecenie człowieka wskazujące konkretne ID; rozbieżności zauważone przy okazji raportuj w analizie wpływu zamiast naprawiać hurtem. Powiązane: [[gate-rule-liveness]] — gdyby kiedyś powstała reguła pilnująca statusu, musi dostać stałą mutację w `kk-selftest`.
