---
name: audit-log-resource-check-subset-of-resources
description: audit_log_resource_check to świadomy PODZBIÓR RESOURCES, nie kopia — nowy zasób w rbac.contract.mjs NIE trafia tam automatycznie i żadna bramka tego nie wykryje
metadata:
  type: project
---

Tabela `audit_log` ma dwa niezależne słowniki-CHECK, pilnowane wyłącznie ręcznie migracjami:
- `audit_log_operation_check` — lustro `AUDIT_REQUIREMENTS.mustLog` (7 wartości od 20260910103000);
- `audit_log_resource_check` — **podzbiór** `RESOURCES`, **15 wartości NA ŻYWEJ BAZIE**
  (13 pierwotnych + `visit_duration_baskets` + `system_config`). Migracja 20260915120000
  URUCHOMIONA 2026-09-15 za jawną zgodą człowieka (okno
  `CAL-SCHEDULING-CONFIG-AUDIT-CHECK-APPLIED`); stan potwierdzony niezależnym odczytem
  `pg_get_constraintdef`, kolejność wartości zgodna z blokiem ADD CONSTRAINT w pliku.
  Nagłówek migracji przepisany na stan faktyczny, zastrzeżenia przy
  `CAL-VISIT-DURATION-BASKETS` i `CAL-TRAVEL-BUFFER` zdjęte (patrz
  [[cal-scheduling-config-closed]]) — ekran `/settings/calendar` działa w produkcji.
  Cykl tego pliku (napisany jako NIEZAAPLIKOWANY -> uruchomiony -> nagłówek przepisany)
  jest wzorcem dla każdej następnej migracji słownikowej.

`RESOURCES` w `contracts/rbac.contract.mjs` ma dziś ~28 pozycji. Rozjazd jest ZAMIERZONY:
pełna synchronizacja dopuściłaby do rejestru zasoby bez nośnika w bazie (np. `regions` — zasób
w macierzy, tabela nigdy nie powstała, model promieniowy zastąpił regionowy, patrz
[[calendar-foundation-radius-model]]).

**Why:** `kk-validate`, `kk-codegen` i Prisma NIE wiedzą o tym CHECK-u — nic nie jest z niego
generowane (sprawdzone: `--check` czyste po dopisaniu dwóch wartości), a `AUDIT_REQUIREMENTS`
opisuje tylko `operation` i `legalBasis`, nigdy `resource`. Nie istnieje też żadna równoległa
lista Zod/TS. Skutek: dopisanie zasobu do `RESOURCES` przechodzi przez wszystkie bramki na
zielono, a pierwszy `auditLog.create` z tym `resource` wywraca CAŁĄ transakcję Server Action
(wpis audytowy jest w tej samej transakcji co zapis danych). Tak powstało R-6 w WO
CAL-SCHEDULING-CONFIG-UI — wykryte dopiero przez odczyt `pg_constraint` na żywej bazie.

**How to apply:** przy każdym oknie dodającym zasób do `RESOURCES` zapytaj, czy ten zasób
będzie coś logował. Jeśli tak — osobna migracja `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`
(wzorce: 20260910103000 dla operacji, 20260915120000 dla zasobów), z 13/15 starymi wartościami
przepisanymi DOSŁOWNIE z migracji źródłowej 20260901220000, nie z pamięci. Zmiana jest
rozszerzająca, więc bez backfillu. Weryfikuj techniką z
[[sql-verify-via-rolled-back-tx]] — `pg_get_constraintdef` przed/po plus próbny INSERT.
