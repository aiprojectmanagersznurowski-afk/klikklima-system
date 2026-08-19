---
description: Niezależna recenzja bieżącego diffu przez reviewera i audytora bezpieczeństwa
---

<!-- WYGENEROWANE z .claude/commands/kk-review.md przez tools/kk-port-antigravity.mjs — nie edytuj ręcznie. -->

# Recenzja: {{args}}

## Zakres zmian
- !`git diff --stat`
- Pliki: !`git diff --name-only`

## Zadanie

Uruchom **równolegle** dwóch subagent (invoke_subagent)ów:
- `reviewer` — zgodność z Work Order i kontraktem, uczciwość testów, standardy inżynierskie i UI,
- `rls-security-auditor` — jeżeli diff dotyka: danych osobowych, ról, RLS, usuwania rekordów, Storage, kluczy.

Nie streszczaj im swojego rozumowania ani uzasadnień implementera — mają ocenić kod, nie intencję.

Zestaw wyniki w jednej tabeli: `Waga | Plik:linia | Problem | Poprawka | Agent`.
Podaj jedną rekomendację końcową: **PRZEPUŚCIĆ** albo **WRÓCIĆ DO GREEN**.
