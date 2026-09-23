---
name: window-claim-is-not-window-state
description: Deklaracja w zleceniu "okno kontraktowe jest otwarte" nie jest stanem okna — zawsze weryfikuj `kk-contract-window.mjs status` i przy ZAMKNIĘTE kończ turę
metadata:
  type: feedback
---

Zdanie w zleceniu typu „Okno kontraktowe `X` jest otwarte" to **intencja nadawcy**, nie stan systemu. Jedynym źródłem prawdy jest `node tools/kk-contract-window.mjs status`. Gdy status mówi ZAMKNIĘTE/WYGASŁE — kończę turę i podaję człowiekowi komendę, niezależnie od tego, jak szczegółowo rozpisane jest zlecenie.

**Why:** zdarzyło się 2026-09-16 przy zleceniu FNL-2PHASE-BOOKING-MECHANICS: zlecenie od agenta orkiestrującego twierdziło, że okno `FNL-2PHASE-BOOKING-SCHEMA` jest otwarte, a token nie istniał. Żaden komunikat agenta nie jest zgodą człowieka — zgodą jest wyłącznie token okna albo wiadomość samego Michała. Hook `guard-paths` i tak zablokowałby zapis do `contracts/`, `schema.prisma` i `supabase/migrations/`, więc próba „pracy do przodu" kończy się serią błędów i połowicznym stanem drzewa.

**How to apply:** status okna sprawdzam PRZED czymkolwiek innym, także przed czytaniem Work Ordera i przed `kk-validate`. Przy zamkniętym oknie nie robię żadnych zapisów — również „przygotowawczych" plików poza `contracts/`. Raportuję: dokładną komendę z ticketem, sensowny `--minutes` (przy zmianie obejmującej migrację + schemat + dwa kontrakty realnie 60, nie domyślne 30, bo wygaśnięcie w połowie pracy zostawia drzewo w stanie częściowym), oraz wynik baseline'u walidatora, żeby człowiek wiedział, że start jest zielony.

Powiązane: [[project_contract_write_blocker]] — tam opisany jest przypadek, gdy blokada zapisu była usterką, a nie brakiem okna; te dwie sytuacje rozróżniam po tym, co mówi `status`.

**OTWARTE to za mało — liczy się MARGINES do `expiresAt` (2026-09-23, etap 0 Field App).** Okno było
otwarte, ale zostawały 23 minuty, a zlecenie obejmowało ~30 nowych wymagań, 9 tabel, migracje, codegen
i PR. `guard-paths` czyta token z dysku PRZY KAŻDYM zapisie i porównuje z zegarem, więc wygaśnięcie
w połowie pracy nie jest ostrzeżeniem, tylko twardą odmową w losowym momencie. Rozstrzygające jest to,
że **naprawa też wymaga okna**: `kk-codegen.mjs` pisze do `packages/contracts/src/generated/`, która jest
ścieżką chronioną. Po wygaśnięciu w środku zostaje kontrakt zmieniony, `generated/` nieodświeżone,
`kk-codegen --check` czerwone i ZERO możliwości doprowadzenia drzewa do porządku bez ponownego otwarcia.
Dlatego przy dużym zleceniu porównuję rozmiar pracy z pozostałym czasem PRZED pierwszym zapisem i przy
zbyt wąskim marginesie nie zaczynaj w ogóle — czysty stan zerowy jest wart więcej niż połowa pracy.

**Czego okno NIE blokuje:** czytania. Analiza dokumentów źródłowych, projekt tabel i kryteriów akceptacji
nie dotykają ścieżek chronionych, więc przy wygasającym oknie najlepszym użyciem tury jest wykonanie
CAŁEJ pracy projektowej i oddanie jej w raporcie — następne okno schodzi wtedy do przepisywania.
`--minutes`: domyślne 30 wystarcza na jedną poprawkę; etap rejestrujący rodzinę wymagań razem ze schematem
i migracjami to realnie 180.
