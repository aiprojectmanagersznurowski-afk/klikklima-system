---
name: project-rls-baseline-landed
description: RLS jest już w repozytorium (migracja SEC-RLS-BASELINE, 2026-08-24) — co obejmuje, a czego RLS w tym systemie NIE chroni (ścieżka Prisma)
metadata:
  type: project
---

**Stan aktualny (od 2026-08-24):** `supabase/migrations/20260824185845_security_enable_rls_baseline.sql`
włącza RLS na 18/18 tabel i zakłada polityki. Wcześniejsza wersja tej notatki („RLS nie istnieje
w repozytorium") jest **nieaktualna** — baseline `00000000000000_baseline.sql` faktycznie nie miał
ani jednego `ENABLE ROW LEVEL SECURITY`, ale migracja SEC-RLS-BASELINE to domknęła.

Co polityka realnie zamyka:
- `AuthorizedUser` i `audytorzy`: `FOR SELECT TO authenticated USING (email = auth.email())` —
  koniec z odczytem `iban`/`nip`/`adres` przez PostgREST kluczem anon (klucz anon jest w bundlu).
- `klienci` / `adresy` / `leady`: wyłącznie INSERT dla anon (ścieżka Triage B2C).
- katalogi (`indoor_units`, `outdoor_units`, `cennik_uslug`): publiczny SELECT, świadomie.

**Why:** ta migracja zmienia werdykt „stan RLS jest z repo niedowodliwy" na „polityki są w VCS
i da się je przeczytać". Ale **nie zmienia modelu zagrożeń panelu B2B**.

**How to apply — najważniejszy caveat:** RLS **nie chroni ścieżki Prisma**. Migracja nie używa
`FORCE ROW LEVEL SECURITY`, a Prisma łączy się rolą właściciela. Każde
`prisma.audytorzy.findUnique({ where: { email } })` w Server Action omija te polityki w całości.
Nigdy nie pisz, że „identyfikacja po e-mailu opiera się na tabeli chronionej RLS-em" — kotwicą
zaufania dla tożsamości w Server Action jest wyłącznie `supabase.auth.getUser()` (weryfikacja JWT
po stronie serwera), a autoryzacją — jawne `can()` + wiązanie roli z encją w kodzie akcji.
Patrz [[feedback-audit-execution-constraints]].
