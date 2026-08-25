---
name: naming-baseline-grows
description: kk-naming --check-baseline zapala się przy KAŻDYM nowym kodzie dotykającym prisma.audytorzy / zespoly_monterskie; to nie jest defekt implementacji
metadata:
  type: project
---

`node tools/kk-naming.mjs --check-baseline` liczy trafienia adr002-pl-* NA PLIK. Każde nowe
odwołanie do modeli `audytorzy`, `zespoly_monterskie`, `leady`, `instalacje` (także klucz w mocku
Prismy w teście) podbija licznik ponad baseline i zapala bramkę na czerwono — mimo że kodu nie da
się napisać inaczej, dopóki modele nie zostaną przemianowane (ADR-012, faza 1).

**Why:** zmierzone 2026-08-25 przy WO FLD-CONSENT-DOCS: +5 naruszeń (auditors/actions.ts 11→12,
crews/actions.ts 10→11, legal-document-consent.test.ts 0→3), wyłącznie z `prisma.audytorzy
.findUnique` i kluczy mocka. Baseline był już wcześniej odświeżany w zwykłych commitach naprawczych
(3f6ae35, 3fce819), więc odświeżenie jest przyjętą praktyką, nie obejściem bramki.

**How to apply:** nie zgłaszaj tego jako defektu implementera. Zgłoś jako pozycję do odświeżenia
baseline'u przed commitem i zweryfikuj tylko jedno: czy WSZYSTKIE nowe trafienia to faktycznie
zamrożone nazwy legacy, a nie świeżo wymyślona polska nazwa (tę zgłaszasz jako BLOCKER ADR-002).

Powiązane: [[project-allow-in-write-hook]]
