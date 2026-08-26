---
name: requirement-status-drift
description: Pole status w requirements.contract.mjs nie jest pilnowane przez żadną regułę bramki — wpis zamknięty implementacją i testami zostaje TODO, dopóki człowiek nie zleci poprawki
metadata:
  type: project
---

`status` we wpisach `R(...)` w `contracts/requirements.contract.mjs` jest deklaracją, nie faktem wyprowadzonym z repozytorium. Ani `kk-validate.mjs`, ani `kk-selftest.mjs`, ani `kk-codegen --check` nie porównują `status` z rzeczywistym pokryciem; `kk-trace.mjs` tylko *wypisuje* zadeklarowany status obok znalezionych testów, więc wpis z kompletem testów potrafi latami raportować `TODO`.

Skutki obserwowane 2026-08-26: `SEC-LEADS-LIST-MINIMIZE` miał zamkniętą implementację, testy i czysty REVIEW, a nadal `TODO` (poprawione w tej turze). `SEC-ASSIGNMENT-POOL-MINIMIZE` ma test `lead-detail-page-pool-spread` i dalej stoi na `TODO` — kandydat na tę samą poprawkę księgową, niezweryfikowany.

**Why:** statystyka pokrycia (`Razem: 26/91`) jest wejściem do planowania, a zaniżony licznik generuje pracę nad czymś, co jest już zrobione. Odwrotny błąd byłby groźniejszy — dlatego domyślnie NIE podbijamy statusu z własnej inicjatywy.

**How to apply:** zmiana `status` na `DONE` to zmiana kontraktu jak każda inna — wymaga otwartego okna i pełnej procedury, ale jest zmianą minimalną (jedno słowo, `replace_all: false`, string zakotwiczony w ID wymagania, bo opisy wpisów zawierają dużo powtarzalnego tekstu). Podbicia dokonuj wyłącznie na wyraźne polecenie człowieka wskazujące konkretne ID; rozbieżności zauważone przy okazji raportuj w analizie wpływu zamiast naprawiać hurtem. Powiązane: [[gate-rule-liveness]] — gdyby kiedyś powstała reguła pilnująca statusu, musi dostać stałą mutację w `kk-selftest`.
