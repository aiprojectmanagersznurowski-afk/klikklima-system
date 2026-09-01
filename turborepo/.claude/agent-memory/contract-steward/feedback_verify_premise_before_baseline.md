---
name: verify-premise-before-baseline
description: Uzasadnienie zlecenia („wszystkie nowe trafienia są w testach") sprawdzam per plik, zanim zaktualizuję baseline nazewnictwa — bywa nieścisłe
metadata:
  type: feedback
---

Kiedy zlecenie uzasadnia `--update-baseline` zdaniem typu „wszystkie nowe wpisy są w plikach testowych,
zero w kodzie produkcyjnym", **weryfikuję to per plik przed uruchomieniem narzędzia** i podaję w podsumowaniu
prawdziwy rozkład, nawet gdy przeczy uzasadnieniu.

**Why:** 2026-09-01 (okno `BATCH-B-CONTRACT-WORK`, WO `SRV-SOURCE-OF-TRUTH-SERVICES-VIEW`) zlecenie mówiło
„zero w kodzie produkcyjnym", a delta +34 zawierała +7 w `services/actions.ts` — pliku produkcyjnym.
Decyzja o baseline i tak była słuszna (wszystkie identyfikatory: `serwisy`, `instalacje`, `instalacja_id`,
`klient_id`, `adres_id`, `imie_i_nazwisko` istnieją w `schema.prisma`), ale gdybym przyjął premisę na słowo,
nie sprawdziłbym akurat tych trafień, które jako jedyne mogą przemycić NOWĄ polską nazwę. Baseline to rejestr
długu, a nie miejsce, gdzie coś znika po cichu.

**How to apply:** `--check-baseline`, rozbicie delty per plik, oddzielenie plików testowych od produkcyjnych,
sprawdzenie każdego identyfikatora z pliku produkcyjnego w `schema.prisma` (kryterium z
[[naming-baseline-on-migrations]]: ISTNIEJE → baseline, NIE ISTNIEJE → stop i pytanie), dopiero potem
`--update-baseline`. Rozbieżność z uzasadnieniem zlecenia zgłaszam wprost, bez dramatyzowania — to korekta
faktu, nie zarzut.
