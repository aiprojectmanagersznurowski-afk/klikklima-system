---
description: Niezależna recenzja bieżącego diffu przez reviewera i audytora bezpieczeństwa
argument-hint: "[REQ-ID]"
allowed-tools: Read, Grep, Glob, Bash(git*), Bash(node tools/*), Agent(reviewer, rls-security-auditor)
---

# Recenzja: $ARGUMENTS

## Zakres zmian
- !`git diff --stat`
- Pliki: !`git diff --name-only`

## Zadanie

Uruchom **równolegle** dwóch subagentów:
- `reviewer` — zgodność z Work Order i kontraktem, uczciwość testów, standardy inżynierskie i UI,
- `rls-security-auditor` — jeżeli diff dotyka: danych osobowych, ról, RLS, usuwania rekordów, Storage, kluczy.

Nie streszczaj im swojego rozumowania ani uzasadnień implementera — mają ocenić kod, nie intencję.

Zestaw wyniki w jednej tabeli: `Waga | Plik:linia | Problem | Poprawka | Agent`.
Podaj jedną rekomendację końcową: **PRZEPUŚCIĆ** albo **WRÓCIĆ DO GREEN**.
