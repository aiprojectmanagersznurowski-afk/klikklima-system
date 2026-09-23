---
name: etap0-field-app-registration
description: Etap 0 Field App (46 wymagań, 11 tabel, 4 migracje) — cztery rozstrzygnięcia Michała z 2026-09-23 i decyzje projektowe, których dokumenty źródłowe nie zawierały
metadata:
  type: project
---

Rejestracja etapu 0 (Field App + podpis + wycena kosztorysowa) wykonana 2026-09-23 na gałęzi
`chore/contract-registration`, okno `KK-IMPL-2026Q4`. Zakres: 46 nowych wymagań (228 kryteriów),
3 przepisane wpisy, 11 nowych tabel, 4 migracje `20260925090000`-`093000` **NIEURUCHOMIONE**.

**Why:** to jest fundament blokujący `feat/field-app-foundation`; źródłem jest
`docs/workorders/FIELD-APP-I-PODPISY-ZAKRES.md` (D1-D17) — dokument ZATWIERDZONY, więc jego
rozstrzygnięcia są wiążące i nie wolno ich „poprawiać" przy okazji implementacji.

**How to apply:** zanim zaplanujesz cokolwiek z rodzin `FLD-*`, `FLD-SIGN-*`, `PRICE-*`, `INV-*`,
sprawdź te decyzje — kilku z nich NIE MA w żadnym dokumencie źródłowym, powstały przy rejestracji:

- **Aktor systemowy NIE jest rolą.** `SYSTEM_ACTOR` + `SYSTEM_GRANTS` w `contracts/rbac.contract.mjs`,
  osobno od `ROLES`. Powód rozstrzygający: `ROLES` to dziedzina kolumny `authorized_users.role`
  z CHECK-iem w bazie (migracja 20260907173000), więc `SYSTEM` na tej liście = konto, na które da się
  zalogować. Nadanie jest wąskie (`invoices:create`), a reguła R31 zabrania automatowi `update`
  i `delete`. Tożsamość aktora wolno przyjąć WYŁĄCZNIE po weryfikacji podpisu dostawcy płatności,
  nigdy z nagłówka. Michał wybrał „przez `can()`", nie „wyjątek obok `can()`".
- **Polimorfizm podpisu:** `document_type` + `document_id` + CHECK, bez klucza obcego — bo D4.3
  wymienia dokładnie dwa dokumenty podpisywane przez klienta. Koszt (baza nie zatrzyma podpisu-sieroty)
  jest zapisany w migracji i w `schema.prisma`. Trzeci typ dokumentu = moment na ponowne rozważenie
  encji nadrzędnej.
- **`installation_contracts`, nie `contracts`** (zatwierdzone przez Michała): `contracts` jest poprawne
  wg ADR-002, ale kolidowałoby w audycie z katalogiem źródła prawdy.
- **`quote_items.room_id` nullowalne DOMENOWO** (brak = pozycja ogólna, D17). Pilnuje tego
  `quote_items_scope_room_consistency_check`, a `scope` jest zdenormalizowany z cennika, bo CHECK
  nie sięga do innej tabeli. Bez tego: trasy freonowe bez pomieszczenia i montaż jednostki zewnętrznej
  policzony raz na KAŻDE pomieszczenie — oba błędy widać dopiero na fakturze.
- **`FNL-2PHASE-INVOICE` jest dziś ODWRÓCONE względem swojej nazwy** — znaczy „brak faktury po etapie I"
  (D9: rozliczenie przy `T09`, nigdy przy `T17`). ID nie zmieniono, żeby nie zrywać historii.
  Konsekwencja: `N8a` straciło `attachments` W CAŁOŚCI (nie wyzerowane), bo pole było nośnikiem
  kryterium, które przestało istnieć.
- **Próg 300 m² żyje w `SLA.PROPERTY_AREA_VAT_THRESHOLD` (`sqm`)** i NIGDZIE indziej. Słownik
  `PROPERTY_AREA_BANDS` opisuje pasma przez `boundary`, nie przez liczbę — pilnuje tego R32.
  Rozszerzenie `MEASURES` o `sqm` wymagało trzech miejsc: `MEASURES`, `SCALAR_RANGES`
  i `MEASURE_SCALARS` w codegenie (komentarz przy R21 ostrzega o tym trzecim).

Świadomie NIEZROBIONE, z właścicielem: `installations:update` dla audytora (potrzebne dla
`FLD-AUDIT-INSTALL-TYPE`) — rozszerzenie uprawnień zależy od tego, czy tryb montażu ląduje najpierw
na ofercie; rozstrzyga to Work Order tamtego ID, nie ta rejestracja.
Wpis do `docs/01-ADR-spec-conflicts.md` (aneks ADR-013 + drugie wejście do lejka) należy do
`doc-scribe` — `docs/` jest poza zakresem zapisu stewarda, mimo że zlecenie o to prosiło.

Powiązane: [[naming-baseline-on-migrations]] (delta +24, wszystko moje),
[[window-claim-is-not-window-state]], [[gate-rule-liveness]] (R31/R32 mają po 3-4 mutacje).
