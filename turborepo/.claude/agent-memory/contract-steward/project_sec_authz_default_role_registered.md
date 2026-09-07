---
name: project-sec-authz-default-role-registered
description: SEC-AUTHZ-DEFAULT-ROLE zarejestrowane 2026-09-07 — schema-level fail-open default na AuthorizedUser.role, jeszcze nie zaimplementowane
metadata:
  type: project
---

`SEC-AUTHZ-DEFAULT-ROLE` zarejestrowane w `contracts/requirements.contract.mjs` (status TODO, risk HIGH, domain security) na oknie kontraktowym `SEC-AUTHZ-DEFAULT-ROLE` (2026-09-07).

**Znalezisko:** `packages/database/prisma/schema.prisma:86-92`, model `AuthorizedUser`, pole `role String @default("admin")` (linia 89). Jedyny dzisiejszy punkt zapisu, `addAuthorizedUser` (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts:19`), zawsze przekazuje `role` explicite jako parametr obowiązkowy — więc dziś default jest nieużywany w praktyce, ale schemat sam jest fail-open dla każdego przyszłego punktu zapisu, który go pominie (nowa Server Action, seed migracji, ręczny INSERT, trigger Supabase Auth).

**Why:** analogiczna pułapka do "brak sprawdzenia roli to podatność" z CLAUDE.md, tylko przesunięta z warstwy Server Action na warstwę bazy — nie została zapowiedziana w żadnym wcześniejszym oknie (w przeciwieństwie do [[project_sec_last_admin_guard_registered]], które kontynuowało zapowiedziany dług z SEC-AUDIT-LOG-ROLE-CHANGE).

**Kryteria (AC1-AC4):** AC1 usunięcie `@default` w schemacie (NOT NULL bez default); AC2 nieregresja `addAuthorizedUser` (już dziś explicite, więc nie jest to breaking); AC3 pytanie otwarte, NIE rozstrzygnięte tutaj — czy migracja usuwająca default powinna też dodać `CHECK (role IN (...))` egzekwujący `ROLES` z `rbac.contract.mjs` jako drugą linię obrony bazodanową, czy to osobne zadanie; AC4 wymaga jednorazowego `SELECT * FROM "AuthorizedUser"` przed migracją, żeby sprawdzić czy istniejące wiersze mają zamierzoną rolę (nie ryzyko utraty danych, tylko weryfikacja).

**How to apply:** implementacja (migracja `ALTER COLUMN role DROP DEFAULT` + ewentualny CHECK + weryfikacja żywej bazy) to osobny krok /kk-plan po akceptacji WO przez człowieka — decyzja o CHECK-u NIE jest do podjęcia przez implementera, tylko przez człowieka w Work Orderze. Schemat i migracje NIE zostały dotknięte w tym oknie — tylko rejestr wymagań i regenerowany kod.

Codegen po dodaniu: `packages/contracts/src/generated/requirements.ts` zregenerowany, `kk-codegen.mjs --check` zielone, `kk-validate.mjs` i `kk-selftest.mjs` zielone (111 wymagań, te same 6 ostrzeżeń R16-proposed z [[project_blocked_status_semantics]] — niezmienione).
