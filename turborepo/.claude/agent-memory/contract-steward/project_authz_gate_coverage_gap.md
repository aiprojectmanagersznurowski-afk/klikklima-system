---
name: authz-gate-coverage-gap
description: Retrofit sprawdzania ról w panelu B2B jest częściowy, a żadna bramka tego nie wykrywa — macierz RBAC bywa poprawna przy kodzie, który jej nie czyta, a kk-trace zielone przy kryterium bez testu
metadata:
  type: project
---

Poprawna macierz w `contracts/rbac.contract.mjs` NIE oznacza, że kod ją egzekwuje. Retrofit
`getCurrentActorRole()` + `can()` przeszedł tylko przez część plików Server Actions i żadne
narzędzie nie sprawdza pozostałych: `kk-validate.mjs` waliduje wyłącznie spójność kontraktu,
`kk-precommit-scan.mjs` nie zna ani `can(`, ani `getCurrentActorRole`. Zweryfikowane 2026-08-24
przy `SEC-AUTHZ-USER-MGMT` — wtedy 7 plików `actions.ts` w `apps/b2b-web/src/app/(dashboard)/`
nie zawierało żadnego wywołania `can(`, mimo że mutują zasoby objęte macierzą.

**Why:** Prisma omija RLS, więc w panelu B2B jedyną granicą uprawnień jest kod akcji. Luka
`SEC-AUTHZ-USER-MGMT` (dowolny zalogowany mógł nadać sobie `admin`) powstała nie z błędnej
macierzy, tylko z tego, że `settings/actions.ts` nigdy do macierzy nie zajrzał. Znalazł to
dopiero człowiek przez review, a nie bramka — czyli mechanizm wykrywania tej klasy błędu
w ogóle nie istnieje.

Druga warstwa tej samej ślepoty (2026-08-25, rozszerzenie `SEC-AUTHZ-USER-MGMT` o zdolność
`read`): `kk-trace.mjs` liczy pokrycie po ID wymagania, a `kk-codegen.mjs` NIE emituje pola
`acceptance` do `packages/contracts/src/generated/requirements.ts` (tylko id/domain/status/risk/
source/statement). Dopisanie kryterium do istniejącego ID zostawia więc trace na zielono przy
kryterium bez jednego testu, a treść kryterium jest widoczna wyłącznie w pliku `.mjs`.

Trzecie wystąpienie tego samego wzorca (2026-08-25, `CRM-CREW-UPDATE-ADMIN-ONLY`): `crews/actions.ts`
importował już `can` i `getCurrentActorRole` na potrzeby `setSelfAvailabilityAction`, a mimo to
`updateCrewAvatar`, `deleteCrewAction` i `getCrews` w tym samym pliku nie sprawdzały niczego.
Obecność `can(` w pliku NIE dowodzi więc, że plik jest pokryty — przyszła reguła skanu musi liczyć
wywołania per akcja mutująca, nie per plik, inaczej przepuści dokładnie ten przypadek.

**How to apply:** Przy każdym wymaganiu dotyczącym uprawnień pytaj osobno „czy macierz to mówi"
i „czy jakikolwiek kod to czyta" — to dwa różne stany i pierwszy bywa zielony przy drugim
pustym. Jeżeli kiedyś powstanie WO na regułę skanu (Server Action mutująca zasób z `RESOURCES`
bez wywołania `can()`), obowiązuje [[gate-rule-liveness]]: reguła wchodzi razem ze stałą mutacją
w `kk-selftest.mjs`. Sam skan to narzędzie, nie kontrakt — nie dokładaj go przy okazji zmiany
w `contracts/`.
