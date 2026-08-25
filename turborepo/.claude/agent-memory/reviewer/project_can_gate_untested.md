---
name: project-can-gate-untested
description: Otwarta kwestia dla człowieka — wywołanie can() w bramkach Server Actions nie jest pokryte żadnym testem; usunięcie go przechodzi cały pakiet
metadata:
  type: project
---

Wywołanie `can(actorRole, resource, capability)` w bramkach autoryzacyjnych Server Actions
panelu B2B jest **nieaktywne pod testami**. Zmierzone mutacjami 2026-08-25 (review #3 WO
FLD-AVAILABILITY-SPLIT), za każdym razem 118/118 zielonych:
- `setSelfAvailabilityAction` (auditors i crews): zamiana bramki na samo
  `if (actorRole !== 'audytor')` / `!== 'monter'` — pakiet zielony;
- `toggleAuditorActiveAction` (kod PRZEDISTNIEJĄCY): zamiana na `if (actorRole !== 'admin')`
  — pakiet zielony.

Czyli: żaden test nie sprawdza, że akcja w ogóle pyta macierz RBAC. Zachowanie
bezpieczeństwa jest dowiedzione (usunięcie CAŁEJ bramki testy łapią), ale linkage
kod ↔ kontrakt już nie.

**Why:** to nie jest regresja konkretnego WO, tylko konwencja obecna we wszystkich bramkach.
Ma znaczenie, bo zasada zerowa CLAUDE.md mówi „kontrakt jest źródłem prawdy", a decyzja D-A
w FLD-AVAILABILITY-SPLIT rozstrzygnęła R2 właśnie tak: reguła ma żyć w macierzy, „nie tylko
w kodzie akcji, żeby `rls-security-auditor` miał co sprawdzać". Dziś zmiana macierzy
(np. odebranie `audytor:own` na `availability_declarations`) nie zapaliłaby żadnego testu.

**How to apply:** nie zgłaszaj tego jako BLOCKER pojedynczego WO — to zastane, systemowe
i wymaga decyzji człowieka (osobne WO: mockować `can` i asertować argumenty wywołania, czy
zostawić). Zgłaszaj jako MAJOR z adnotacją „przedistniejące, poza zakresem", razem z innymi
znanymi pozycjami z tej listy (deleteCrewAction, updateCrewAvatar, wyciek IBAN,
addAuthorizedUser/deleteAuthorizedUser). Uwaga na pochodną: nazwy testów typu
„rola dyspozytor (brak wariantu :own na availability_declarations)" obiecują mechanizm,
którego test nie weryfikuje — zachowanie jest dziś równoważne, więc to nieścisłość nazwy,
nie fałszywa zieleń.

Powiązane: [[mutation-proof-required]]
