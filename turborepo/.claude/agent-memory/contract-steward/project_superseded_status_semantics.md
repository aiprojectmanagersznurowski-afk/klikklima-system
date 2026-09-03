---
name: superseded-status-semantics
description: Co oznacza SUPERSEDED w rejestrze wymagań, jak traktują go kk-validate i kk-trace, i dlaczego wpis SUPERSEDED bez testów zostaje w ostrzeżeniu HIGH RISK
metadata:
  type: project
---

`SUPERSEDED` to legalny status (`tools/kk-validate.mjs`, lista dozwolonych statusów). Wpisu zastąpionego NIE usuwa się z rejestru — historia i istniejące tagi `@REQ` w testach mają się nie zerwać.

Forma wpisu (wzorzec `CRM-DELETE-ADMIN-ONLY`): `statement` zaczyna się od „ZASTĄPIONE przez <ID>”, `acceptance` ma dokładnie jedną pozycję wskazującą następcę, oryginalny `source` zostaje jako ślad historyczny i dopisuje się do niego drugie źródło (WO + data decyzji).

Dwie pułapki narzędziowe:
- `kk-trace --enforce` liczy naruszenie tylko dla `IMPLEMENTING`/`DONE` bez testu, więc `SUPERSEDED` bez tagów jest zielone.
- Ostrzeżenie „Wymagania HIGH RISK bez żadnego testu” wyklucza wyłącznie `BLOCKED`, nie `SUPERSEDED`. Wpis zastąpiony o `risk: 'HIGH'` i bez tagów zostaje w tej liście na stałe (dziś: `SEC-RODO-DELETE`). To szum, nie regresja — nie „naprawiaj” tego obniżeniem `risk`, bo ryzyko opisuje regułę, która nadal obowiązuje u następcy.

**Why:** przy zastępowaniu wymagania łatwo pomylić „reguła przestała obowiązywać” z „pokrycie liczy się gdzie indziej”. Zawsze chodzi o to drugie — dlatego w `statement` musi być jedno zdanie o tym, KTÓRE dawne kryteria odpadły i dlaczego, żeby nikt ich nie reanimował bez ADR.

**How to apply:** przy każdej decyzji „zastąp wymaganie” w oknie kontraktowym. Powiązane: [[blocked-status-semantics]], [[requirement-status-drift]].
