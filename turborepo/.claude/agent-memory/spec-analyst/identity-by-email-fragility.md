---
name: identity-by-email-fragility
description: Tożsamość "czyj to rekord" w panelu B2B wiąże się po WARTOŚCI e-maila, nie kluczem obcym — to źródło całej klasy podatności :own
metadata:
  type: project
---

Wariant `:own` z `contracts/rbac.contract.mjs` (np. `leads.read = [..., 'audytor:own']`)
jest realizowany przez dociągnięcie własnego rekordu pracownika **po adresie e-mail z sesji
Supabase**: `prisma.audytorzy` / `prisma.zespoly_monterskie` `where: { email: user.email }`.
Nie ma klucza obcego między `AuthorizedUser` a tabelami pracowniczymi.

**Why:** e-mail jest jedynym istniejącym nośnikiem tożsamości między Supabase Auth
a tabelami domenowymi (tak samo działa bramka w `utils/supabase/middleware.ts`).
Konsekwencje, które wracają w kolejnych WO:
- bez `UNIQUE` na `email` `findUnique` zwraca wiersz nieokreślony → eskalacja uprawnień
  (patrz [[migration-ledger-unreliable]] — tego `UNIQUE` na bazie nie ma)
- ten sam adres może istnieć w `audytorzy` **i** `zespoly_monterskie` (stan faktyczny);
  rozstrzyga rola z `AuthorizedUser`, nie tabela pracownika
- zmiana adresu w jednym miejscu cicho odcina dostęp
- pracownik bez e-maila nie ma ścieżki samoobsługi (świadome ograniczenie, `FLD-AVAILABILITY-SPLIT`)

Ustalony wzorzec obrony (`SEC-READ-GATES`, kopiuj — nie wymyślaj nowego):
`findMany({ where: { email }, take: 2 })` + odmowa gdy `length !== 1` lub rekord nieaktywny.
Asymetria nazw kolumn jest realna: `audytorzy.is_active`, `zespoly_monterskie.aktywny`.

**How to apply:** w każdym WO dotykającym `:own` sprawdź, czy wyznaczenie tożsamości
przechodzi przez `findUnique` po e-mailu — jeśli tak, to jest znalezisko, nie szczegół.
Docelowa naprawa strukturalna (klucz obcy) wymaga osobnego ADR i migracji danych;
nie rozstrzygaj tego w WO.
