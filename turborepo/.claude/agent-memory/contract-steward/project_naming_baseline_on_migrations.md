---
name: naming-baseline-on-migrations
description: Każda migracja i każdy model dotykający audytorzy/zespoly_monterskie/leady podbija licznik adr002-pl-tables i blokuje pre-commit — baseline aktualizuje CZŁOWIEK, nie agent
metadata:
  type: project
---

Zmiana schematu dotykająca tabel o polskich nazwach (`audytorzy`, `zespoly_monterskie`, `leady`, `adresy`, …)
zawsze generuje NOWE trafienia reguł `adr002-pl-tables` / `adr002-pl-columns` w `kk-naming.mjs --check-baseline`,
a ten krok jest w `.githooks/pre-commit` (`FAIL=1`). Hook zapisu tego nie zauważy — obie reguły mają
`allowInWriteHook: true` w `tools/kk.config.mjs`, więc plik zapisze się bez protestu i problem ujawni się
dopiero przy commicie człowieka.

Precedens: migracje `20260820120100_crm_safe_record_actions_columns.sql` (+9) i
`20260820130000_fld_geo_coords_address_coordinates.sql` (+3) siedzą w `tools/kk-naming-baseline.json` —
przyjętym rozwiązaniem jest świadome `node tools/kk-naming.mjs --update-baseline`, a NIE `--no-verify`.
Przy `FLD-AVAILABILITY-SPLIT` (2026-08-21) było to +12 (10 w migracji, 2 w `schema.prisma` — typy relacji
`audytorzy?` / `zespoly_monterskie?` w nowym modelu).

**Why:** dług `KK-NAMING-BASELINE` jest zamrożony, a nie naprawiony, więc odwołanie do starej nazwy tabeli
jest nieuniknione w każdej nowej migracji — nowe obiekty nazywa się po angielsku, ale FK i `ALTER TABLE`
muszą wskazać nazwę, która istnieje. Baseline nie odróżnia „nowe naruszenie" od „nowa linijka wskazująca
stare naruszenie", bo liczy trafienia per plik.

**How to apply:** licz delty przed oddaniem pracy (`node tools/kk-naming.mjs --check-baseline`) i podaj
człowiekowi w podsumowaniu dokładną liczbę oraz gotową komendę. Sam baseline'u NIE aktualizuj — to zapis
w rejestrze długu, czyli decyzja człowieka, a przy okazji jedyny moment, w którym ktoś patrzy, czy przyrost
to faktycznie referencje do starych nazw, a nie nowa polska nazwa przemycona do schematu.
Powiązane: [[precommit-absolute-debt]], [[contract-write-blocker]].
