---
name: feedback-rls-probe-as-role
description: Przepis na WYKONANIE polityki RLS jako konkretna rola Postgresa (authenticated/anon) przez Prisma $queryRawUnsafe + SET LOCAL ROLE + set_config('request.jwt.claims') w wycofanej transakcji — bez psql, docker i bez zapisu do bazy
metadata:
  type: feedback
---

Politykę RLS weryfikuj **wykonaniem predykatu jako konkretna rola**, nie lekturą SQL-a.
W tym repo da się to zrobić bez `psql`, `docker` i `supabase` CLI, i bez ŻADNEGO zapisu
do bazy. Uzupełnia [[feedback-audit-execution-constraints]].

**Why:** Michal żąda „weryfikacji praktycznej, nie deklaratywnej" — polityka, której nikt nie
wykonał, jest komentarzem w SQL. Do 2026-08-28 wpisywałem w werdykty „nie mam jak sprawdzić
polityki", co było FAŁSZEM: `packages/database/.env` ma `DATABASE_URL` do żywej bazy, a
`@prisma/client` jest zainstalowany. Ta metoda znalazła twardy dowód (fail-closed przy
`auth.email() IS NULL`), którego sama lektura migracji nie daje.

**How to apply:**
1. Uruchamiaj z katalogu `packages/database` (tam leży `.env` z `DATABASE_URL`), skryptem na
   STDIN: `node --input-type=module - <<'ENDOFSCRIPT' … ENDOFSCRIPT`. Wariant `-e "…"`
   wywala się na cudzysłowach w SQL-u.
2. Konfiguracja (czysty odczyt, bez transakcji): `pg_policies` (policyname/cmd/roles/qual/
   with_check), `pg_class.relrowsecurity` + `relforcerowsecurity`, `storage.buckets.public`,
   `information_schema.role_table_grants`.
3. **Wykonanie predykatu jako rola** — w `p.$transaction(async tx => { … })`:
   - `tx.$queryRawUnsafe("SELECT set_config('request.jwt.claims', $1, true)", JSON.stringify({email, role:'authenticated'}))`
     (parametryzowane; `SET LOCAL` nie przyjmuje parametrów, `set_config(...,true)` tak),
   - `tx.$executeRawUnsafe('SET LOCAL ROLE authenticated')`,
   - `tx.$queryRawUnsafe("SELECT auth.email() AS e, (<predykat polityki>) AS pass")`,
   - **na koniec `throw new Error('ROLLBACK_INTENTIONAL')`** i połknij ten wyjątek — transakcja
     się wycofuje, baza nietknięta, `SET LOCAL ROLE` sam wygasa. To spełnia zakres „tylko odczyt".
4. Zawsze przepuść komplet wariantów: rola uprawniona, rola nieuprawniona, e-mail spoza tabeli,
   **brak claims (`auth.email()` = NULL)**, claims bez pola `email`, `email` = pusty string,
   oraz zasób spoza zakresu polityki (np. inny `bucket_id`). Wariant NULL jest najważniejszy —
   `au.email = NULL` daje NULL, więc `EXISTS` jest false i polityka jest fail-closed; to trzeba
   POKAZAĆ, bo z lektury wygląda na przeoczenie.
5. **Pułapka, którą ta metoda rozstrzyga:** podzapytanie `EXISTS (SELECT … FROM public."AuthorizedUser")`
   wewnątrz polityki wykonuje się jako WOŁAJĄCY, więc RLS tamtej tabeli TEŻ obowiązuje.
   Polityka „self read by email" na `AuthorizedUser` akurat to przepuszcza (admin widzi swój
   wiersz), ale to fakt zmierzony, nie oczywisty — sprawdzaj go za każdym razem.
6. Maskuj e-maile w wypisie (`e[0]+'***@'+domena`) — to dane osobowe, a wynik audytu bywa
   wklejany dalej.
