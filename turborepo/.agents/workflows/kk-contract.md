---
description: Kontrolowana zmiana kontraktu — wymaga otwartego okna kontraktowego
---

<!-- WYGENEROWANE z .claude/commands/kk-contract.md przez tools/kk-port-antigravity.mjs — nie edytuj ręcznie. -->

# Zmiana kontraktu: {{args}}

## Stan wejściowy
- Okno kontraktowe: !`node tools/kk-contract-window.mjs status`
- Walidacja: !`node tools/kk-validate.mjs 2>&1 | tail -6`

## Procedura

1. Jeżeli okno jest **ZAMKNIĘTE** — zatrzymaj się i poproś mnie o uruchomienie:
   ```
   node tools/kk-contract-window.mjs open <REQ-ID>
   ```
   Nie próbuj obejść tego ograniczenia. Ono istnieje po to, żeby zmiana kontraktu nigdy nie była skutkiem ubocznym implementacji.

2. Przedstaw mi **propozycję zmiany przed jej wykonaniem**: co dokładnie się zmienia, dlaczego nie da się bez tego, co przestanie być aktualne. Poczekaj na zgodę.

3. Deleguj do `contract-steward`.

4. Po jego pracy zweryfikuj osobiście:
   ```
   node tools/kk-validate.mjs --strict
   node tools/kk-selftest.mjs
   node tools/kk-codegen.mjs --check
   node tools/kk-trace.mjs
   ```

5. Pokaż mi **analizę wpływu**: testy do przepisania, kod do zaktualizowania, migracje do wykonania.

6. Przypomnij mi o zamknięciu okna: `node tools/kk-contract-window.mjs close`.
