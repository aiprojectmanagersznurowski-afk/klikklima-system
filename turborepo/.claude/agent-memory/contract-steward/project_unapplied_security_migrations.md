---
name: unapplied-security-migrations
description: Wzorzec pracy dla migracji, których obecność w repo nie dowodzi zastosowania — sześć migracji bezpieczeństwa + perf_foreign_key_indexes, wszystkie zweryfikowane jako URUCHOMIONE na żywo (stan na 2026-09-03); także starzenie się pomiarów w nagłówkach
metadata:
  type: project
---

**AKTUALIZACJA 2026-09-03: wszystkie SZEŚĆ migracji z tej notatki zostało uruchomionych na żywej
bazie i zweryfikowanych bezpośrednim zapytaniem (nie tylko lekturą pliku).** Ta notatka opisuje
teraz WZORZEC do stosowania przy KOLEJNYCH migracjach bezpieczeństwa/schematu, nie aktualny stan
zaległości — nie zakładaj, że którakolwiek z wymienionych niżej wciąż czeka.

Historia (wszystkie potwierdzone jako zastosowane):

- `20260824185845_security_enable_rls_baseline.sql` — RLS włączone (potwierdzone `pg_class.relrowsecurity`)
- `20260901120000_security_revoke_authorized_user_writes.sql` — REVOKE zastosowany (potwierdzone `information_schema.role_table_grants`)
- `20260901120100_security_knowledge_base_buckets_private.sql` — buckety `public=false` (potwierdzone `storage.buckets`, curl na trzech podpisanych URL-ach z `apps/b2c-web/lib/articles.ts` → 200)
- `20260901210000_logistics_sla_paused_at.sql` — kolumna `leady.logistics_sla_paused_at` istnieje (potwierdzone `information_schema.columns`)
- `20260903061000_security_employee_email_unique_reassert.sql` — UNIQUE na `audytorzy.email`
  i `zespoly_monterskie.email` (potwierdzone `pg_indexes` + realną próbą duplikatu → `23505
  unique_violation`; dodatkowo `prisma migrate diff` przestał zgłaszać dryf na tej kolumnie).
  Zastąpił martwy `20260822120000_fld_availability_split_employee_email_unique.sql`, który
  nigdy nie został uruchomiony i zostaje w repo wyłącznie jako ślad historii.
- `20260901220000_rodo_audit_log_and_client_anonymization.sql` — tabela `audit_log` istnieje z poprawnymi CHECK-ami, wyzwalaczem `audit_log_append_only_trg` (zweryfikowany transakcją z wymuszonym rollbackiem — UPDATE poprawnie odrzucony, zero wiersza testowego pozostałego), RLS włączone, `klienci.anonymized_at` istnieje

**Why:** obecność pliku migracji w repo dowodzi INTENCJI, nie STANU SERWERA. Raz pomylono te dwie
rzeczy (RLS baseline), stąd wymóg jawnej ramki `NIE ZOSTAŁA URUCHOMIONA` w nagłówku każdej nowej
migracji dopóki człowiek nie da zgody, i zawsze osobnej listy w podsumowaniu tury: „wymaga zgody na
żywe uruchomienie" z pełnymi ścieżkami — nigdy nie raportuj migracji jako „naprawione" na podstawie
samego commita.

**How to apply przy kolejnej migracji:** (1) nagłówek z ramką ostrzegawczą + sekcja weryfikacji
manualnej na dole pliku; (2) po uzyskaniu zgody człowieka — uruchomienie przez skrypt z rozbiorem
instrukcji SQL (dollar-quoting, komentarze, cudzysłowy), zawsze `--dry-run` najpierw; (3) weryfikacja
bezpośrednim zapytaniem do bazy, NIE tylko `exit 0` skryptu; (4) dla append-only tabel — test triggera
przez `$transaction` z wymuszonym rzuceniem błędu na końcu (rollback), nigdy przez INSERT+DELETE
(DELETE zostanie odrzucony przez sam trigger, zostawiając trwały wiersz-śmieć w tabeli, której z
definicji nie da się już wyczyścić); (5) skrypty pomocnicze (`run-migration.mjs`, `verify-*.mjs`)
zawsze usuwane po użyciu, nigdy nie commitowane; (6) **PO uruchomieniu — natychmiast przepisz
nagłówek pliku**: ramka `NIE ZOSTAŁA URUCHOMIONA` znika, wchodzi potwierdzenie z datą i DOWODEM
(konkretny odczyt z katalogu systemowego + kod błędu z próby naruszenia). Przejrzyj przy tym CAŁY
plik, nie samą ramkę — zdania typu „żywa baza tego nie ma", „dopóki plik nie jest uruchomiony, kod
jest jedyną ochroną" są rozsiane po uzasadnieniach i każde z nich staje się nieprawdą. Zdania
opisujące stan sprzed naprawy przestawiaj w czas przeszły i oznaczaj jako stan wyjściowy, zamiast
je kasować — uzasadnienie decyzji ma zostać, kłamstwo o stanie serwera nie.

**Dryf nagłówka NIE dotyczy tylko migracji bezpieczeństwa.** 2026-09-03 ten sam błąd znaleziono w
migracji wydajnościowej `20260902170500_perf_foreign_key_indexes.sql`: człowiek zweryfikował ją na
żywo w trakcie audytu wydajności, ale zapomniał poprawić ramkę. Wszystkie 11 indeksów potwierdzone
w `pg_indexes` (schemat `public`, odczyt 2026-09-03), nagłówek przepisany. Wniosek: przeglądaj
nagłówki KAŻDEJ migracji, nie tylko tych z etykietą SEC-.

**Ramka to nie jedyne kłamstwo w pliku — daty pomiarów starzeją się osobno.** Ten sam plik zawierał
sekcję „TA MIGRACJA DAJE DZIŚ ZERO" opartą na pomiarze „0 klientów, 0 leadów" z 2026-09-02.
2026-09-03 te same tabele miały `klienci = 8027`, `leady = 8015`, `adresy = 8008` — uzasadnienie
wydajnościowe przestało być prawdziwe niezależnie od tego, czy migracja została uruchomiona.
Dlatego przy poprawianiu nagłówka sprawdzaj także LICZBY, na których opiera się uzasadnienie, a nie
tylko zdania o zastosowaniu. Cudzego pomiaru nie nadpisuj: zostaw oryginał i dopisz datowany
DOPISEK z nowym odczytem, wprost mówiąc, czego NIE zmierzyłeś (tu: skąd wzięło się ~8 tys. wierszy).

**Nieaktualny komentarz myli w OBIE strony.** Raz przeczytano ramkę „nie uruchomiona" na migracji
faktycznie zastosowanej i wyciągnięto z tego wniosek o złym stanie bazy; symetrycznie ramka
„uruchomiona" na pliku niezastosowanym uśpiłaby czujność. Dlatego nagłówek zawsze niesie DATĘ
odczytu i zdanie, że jest zapisem z konkretnego dnia, a nie gwarancją na zawsze — jedynym
źródłem prawdy pozostają `pg_indexes` / `pg_constraint`.

Powiązane: [[live-db-objects-outside-migrations]], [[naming-baseline-on-migrations]].
