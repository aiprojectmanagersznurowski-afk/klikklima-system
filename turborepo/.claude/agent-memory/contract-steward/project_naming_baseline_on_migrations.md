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

**Wyjątek od „nie aktualizuj sam" (2026-09-01, BATCH-MEDIUM-LOW-CLEANUP):** człowiek MOŻE zlecić
`--update-baseline` wprost i wtedy to robię — ale nadal rozbijam deltę per plik i osobno wskazuję trafienia
w kodzie PRODUKCYJNYM, bo tylko one mogą ukryć nową polską nazwę. Tam delta wyniosła +69 w 14 parach,
z czego 3 pary w plikach produkcyjnych (`auditors/schema.ts`, `crews/schema.ts`, `AddCrewModal.tsx`).
Okazały się nieszkodliwe: klucze schematu Zod muszą dosłownie odpowiadać ISTNIEJĄCYM kolumnom Prisma
(`certyfikat_fgaz`, `liczba_brygad`, `koordynator_imie_nazwisko`), bo payload leci prosto do `prisma.data`,
a nazwy pól formularza muszą odpowiadać kluczom schematu. To ta sama kategoria co mocki testowe —
referencja do starego długu, nie nowa nazwa. Kryterium rozstrzygające: czy identyfikator ISTNIEJE JUŻ
w `schema.prisma`. Jeśli tak — baseline. Jeśli nie — zatrzymanie i pytanie do człowieka.

**Cennik trafień (zmierzone 2026-08-24, `SEC-RLS-BASELINE`, delta +21 z jednego pliku):** skaner
liczy WYŁĄCZNIE linie kodu — komentarze `--` w `.sql` są pomijane, więc nagłówek migracji może
swobodnie wymieniać `klienci`/`leady`/`audytorzy` w uzasadnieniu i nie kosztuje ani jednego trafienia.
Koszt to funkcja liczby STATEMENTÓW: tabela z polityką = 3 trafienia (`ALTER` + `DROP POLICY`
+ `CREATE POLICY`), tabela z samym `ENABLE ROW LEVEL SECURITY` = 1. Praktyczny wniosek: nie ma sensu
skracać komentarzy, żeby ratować licznik — trzeba skracać liczbę odwołań w SQL, a tych zwykle skrócić
się nie da.

**`--update-baseline` zamraża CAŁE drzewo, nie tylko moje pliki (2026-09-02, PHASE-B-CODEGEN-AND-NAMING):**
narzędzie nie ma opcji per-plik, więc jedno wywołanie wpisuje do baseline także cudzą niezacommitowaną
pracę. Wtedy baseline milcząco ZATWIERDZA nazewnictwo pliku, którego nikt nie recenzował i który nie
wchodzi do commitu. Rozwiązanie, które zastosowałem: `--update-baseline`, a potem usunięcie z
`counts` w `tools/kk-naming-baseline.json` kluczy plików spoza WO (tu: `tests/customers-anonymize-rodo.test.ts`,
Faza B). Baseline zostaje wtedy dokładnie na zakresie commitu, a obcy plik ocenia własne review.

Cena tej decyzji: `.githooks/pre-commit` (linia ~42) uruchamia `kk-naming.mjs --check-baseline` na CAŁYM
drzewie, ignorując stage. Nieskomitowany plik innego WO blokuje więc KAŻDY commit, także taki, którego
własne pliki są czyste — jedyne wyjście to `--no-verify`. Żeby nie stracić sygnału, uruchamiam wtedy ręcznie
`node tools/kk-precommit-scan.mjs $(git diff --cached --name-only --diff-filter=ACM | sed 's|^turborepo/||')`
i wynik (0 naruszeń) wpisuję do treści commitu razem z powodem pominięcia hooka.

**Nie tylko migracje — także testy statyczne nad migracją (2026-09-08, CRM-DELETE-ADMIN-ONLY-LEADS):**
plik `apps/b2b-web/tests/leads-rls-deny-by-default.test.ts` dał +7 (`leady` w nazwach `describe`/`it`, w
asercji `toContain('ALTER TABLE public.leady …')` i w regexie polityk) — komentarze nad kodem nie kosztują,
ale tytuł testu już tak. Precedens: bliźniaczy `crews-rls-deny-by-default.test.ts` siedzi w baseline z 8,
a `rls-deny-by-default-freeze.test.ts` z 20. **STAN OTWARTY:** te +7 NIE są w baseline — commit poszedł
z `--no-verify`, powód i delta wpisane w treść commitu (b6fc5fd). Dopóki człowiek nie uruchomi
`node tools/kk-naming.mjs --update-baseline`, KAŻDY następny commit w tym drzewie jest blokowany tą samą
siódemką, także cudzy i całkowicie czysty.

**Pułapka przy raportowaniu (2026-08-22, WO FLD-AVAILABILITY-SPLIT uzup.):** `--check-baseline` podaje
deltę ZBIORCZĄ dla całego drzewa roboczego, więc miesza moje pliki z niezacommitowaną pracą
`implementer-server` i `test-author`. Przykład: łączna delta +26, z czego moja migracja to +2 — reszta
siedziała w `tests/availability-*.test.ts` i `(dashboard)/{auditors,crews}/actions.ts`. Zawsze rozbijam
liczbę per plik i podaję człowiekowi WŁASNY wkład osobno, inaczej wygląda to jak regres spowodowany
zmianą kontraktu. Sama migracja dokładająca tylko `CREATE UNIQUE INDEX` kosztuje +2 (po jednym `ON public.<tabela>`);
komentarze po polsku nie podbijają licznika, dopóki nie zawierają porzuconej nazwy tabeli — `schema.prisma`
z samym `@unique` miał deltę 0.
