---
name: auditor-radius-rename
description: FLD-AUDITOR-RADIUS-RENAME (2026-09-10) — audytorzy.max_promien_dojazdu_km → promien_dzialania_km; ZAMKNIĘTE: migracja uruchomiona na żywej bazie, kod i testy zaktualizowane
metadata:
  type: project
---

Okno `FLD-AUDITOR-RADIUS-RENAME` zamknięte 2026-09-10, gałąź `contract/FLD-AUDITOR-RADIUS-RENAME`.
Migracja `supabase/migrations/20260910101000_fld_auditor_radius_rename.sql` robi
`RENAME COLUMN max_promien_dojazdu_km TO promien_dzialania_km` na `audytorzy`
(w bloku `DO $$` z testem na `information_schema`, więc jest idempotentna) i nadpisuje
`COMMENT ON COLUMN`, bo RENAME przenosi stary komentarz o „zamrożonej asymetrii" na nową nazwę.

**STAN NA 2026-09-10 (domknięte):** trzy tury przeszły w kolejności. Migracja renamu ORAZ
`20260910103000_audit_log_field_update_operation.sql` zostały uruchomione na żywej bazie
za jawną zgodą Michała — statement-po-statement przez Prisma `$executeRawUnsafe`, nie
`supabase db push` — i zweryfikowane read-only (`information_schema` dla kolumny,
`pg_get_constraintdef` dla CHECK-a, 7 wartości). Nagłówki obu plików przepisane, bo
twierdziły coś przeciwnego → [[unapplied-security-migrations]].

**Why (stan historyczny, przy commicie kontraktowym):** commit był z definicji NIEKOMPLETNY
i zostawiał system w stanie pośrednim, co przy następnym czytaniu wygląda jak regresja:

1. **Migracja nie była uruchomiona na żywej bazie.** Osobny krok za zgodą człowieka.
2. **Kod produkcyjny i testy nie były zaktualizowane** — `guard-paths` nie daje
   `contract-steward` zapisu do `apps/`. Zadanie zlecało tę zmianę „bo to mechaniczny
   rename", ale hook jest twardy i to była właściwa granica: 4 pliki w
   `apps/b2b-web/src/app/(dashboard)/auditors/` (13 wystąpień) idą do implementera,
   6 plików w `apps/b2b-web/tests/` (16 wystąpień) do `test-author`.
3. **`npx tsc --noEmit` łapie tylko 4 z 13 miejsc w kodzie prod** — te w `actions.ts`
   przy Prisma create/update/read. `schema.ts` (klucz w obiekcie Zod) i oba `.tsx`
   (klucz FormData, `register()`) są typowane luźno i **zepsują się po cichu w runtime**:
   Zod nie znajdzie klucza, pole promienia zacznie zapisywać `undefined`. Zielony `tsc`
   NIE jest tu dowodem kompletności renama — trzeba grepować.

**How to apply:** przy każdej następnej zmianie nazwy kolumny w tym repo licz miejsca
grepem, a nie kompilatorem, i planuj trzy tury (steward → implementer → test-author)
przed uruchomieniem migracji na bazie. Kolejność ma znaczenie: migracja uruchomiona
przed turą implementera wywala panel audytorów.

**Dług nazewniczy, którego to NIE naprawia:** `promien_dzialania_km` jest nazwą POLSKĄ,
więc niezgodną z ADR-002 tak samo jak poprzednia; `promien_dzialania_km` nie występuje
w lewej kolumnie `docs/architecture/NAMING.md`, więc użycie jest dozwolone, ale wzorzec
skopiowano z tabeli `zespoly_monterskie`, która sama jest na liście porzuconych (→ `crews`).
Docelowe `auditors.action_radius_km` należy do szerokiej migracji nazewniczej całego
schematu. Baseline nazewnictwa odświeżony o +4 (2229 → 2233) — wyłącznie nazwa tabeli
`audytorzy` w nowej migracji, czego nie da się uniknąć.
