---
description: Faza PLAN — zamienia wymaganie w Work Order z wykonalnymi kryteriami akceptacji
argument-hint: "[REQ-ID lub opis zadania]"
allowed-tools: Read, Grep, Glob, Bash(node tools/*), Agent(spec-analyst)
---

# Faza PLAN dla: $ARGUMENTS

## Kontekst
- Stan kontraktów: !`node tools/kk-validate.mjs 2>&1 | tail -5`
- Pokrycie wymagań: !`node tools/kk-trace.mjs 2>&1 | tail -8`

## Zadanie

1. Ustal, którego wymagania z rejestru dotyczy `$ARGUMENTS`. Jeśli żadnego — zatrzymaj się i powiedz, że wymaganie trzeba najpierw dodać do kontraktu (to zadanie dla człowieka i contract-steward, nie twoje).
2. Jeśli wymaganie ma status `BLOCKED` — wskaż blokujący ADR i **nie planuj implementacji**.
3. Deleguj do subagenta `spec-analyst`, przekazując: ID wymagania, ścieżkę dokumentu źródłowego, wynik `kk-trace`.
4. Odbierz Work Order i przedstaw mi **skrót**: cel, kryteria akceptacji, czy potrzebna jest zmiana kontraktu, pytania otwarte.
5. Zapisz stan pętli do `.claude/state/current-workorder.json`:
   ```json
   { "ticket": "<REQ-ID>", "title": "...", "phase": "PLANNED", "iteration": 0, "maxIterations": 3, "requirements": ["..."] }
   ```

## Zatrzymaj się i zapytaj mnie, jeżeli

- Work Order zawiera `WYMAGA DECYZJI`,
- potrzebna jest zmiana kontraktu,
- wymaganie ma `risk: HIGH` i dotyka pieniędzy, danych osobowych albo komunikacji z klientem.

Nie przechodź do fazy RED bez mojej akceptacji Work Order.
