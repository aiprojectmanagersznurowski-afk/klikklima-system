---
name: mutation-proof-required
description: Przy recenzji testów po iteracji GREEN dowodem "asercja ma zęby" jest mutacja kodu produkcyjnego i uruchomienie, nie lektura; plus jak klasyfikować mutanty, które przeżyły
metadata:
  type: feedback
---

Nie kwalifikuj testu jako „wzmocniony" na podstawie samej lektury. Zmutuj kod produkcyjny
(odwróć wartość, zahardkoduj, usuń bramkę), uruchom test, sprawdź czy pada — i przywróć plik
z kopii w scratchpadzie (`git checkout` skasowałby niezacommitowaną pracę implementera).

**Why:** Michal zlecił to wprost w rundzie 2 review WO FLD-AVAILABILITY-SPLIT: „To jest jedyne
przekonujący dowód, że asercja ma zęby." Runda 1 oparta na lekturze przepuściła trzy testy
autoryzacji, które przechodziły dla podatnej implementacji — dopiero mutacja to ujawniła.

**How to apply:** Zawsze przy recenzji testów po GREEN. Minimalna bateria dla Server Action:
(1) odwrócenie wartości w payloadzie, (2) wartość zahardkodowana, (3) usunięcie bramki roli,
(4) usunięcie porównania właścicielstwa, (5) usunięcie filtra. Osobno sprawdź, czy test
negatywny nie przechodzi z NIEWŁAŚCIWEGO powodu — w vitest niekonfigurowany `vi.fn()` po
`mockReset()` zwraca `undefined`, więc akcja odpada na „brak rekordu", a nie na bramce, którą
test ma w nazwie. Diagnoza: usuń bramkę i sprawdź, czy test w ogóle to zauważy.

**Rola `reviewer` nie ma prawa zapisu poza `.claude/agent-memory/`** — narzędzie Write jest
blokowane przez `guard-paths`, ale zapis przez Bash (`cat > …`, `cp`) przechodzi. Harness
mutacyjny buduj w scratchpadzie przez Bash, nigdy w repo.

**Mutant, który przeżył, to jeszcze nie luka w teście — najpierw go sklasyfikuj:**
- *Mutant równoważny* — zmiana bez wpływu na zachowanie przy pozostałym kodzie. Przykład
  z FLD-AVAILABILITY-SPLIT: podmiana `where: { auditorId: own.id }` na `auditorId: id` przeszła
  cały pakiet, ale wcześniejszy `if (own.id !== id) return` gwarantuje równość w tym punkcie.
  To NIE jest defekt testu; zgłoszenie go byłoby szukaniem na siłę.
- *Mutant równoważny wobec BIEŻĄCEGO kontraktu* — różni się dopiero po zmianie kontraktu
  (np. wycięcie `can(...)` z bramki, gdy rola i tak jest zahardkodowana obok). To realna luka
  w identyfikowalności, ale zwykle MAJOR, nie BLOCKER — patrz [[project-can-gate-untested]].
- *Mutant żywy* — zmienia zachowanie i nikt tego nie łapie. Dopiero to jest BLOCKER.

Powiązane: [[project-known-red-e2e]], [[project-can-gate-untested]]
