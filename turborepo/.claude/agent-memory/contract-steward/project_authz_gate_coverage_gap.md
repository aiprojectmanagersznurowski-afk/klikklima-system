---
name: authz-gate-coverage-gap
description: Retrofit sprawdzania ról w Server Actions panelu B2B jest częściowy, a żadna bramka tego nie wykrywa — macierz RBAC może być poprawna przy kodzie, który jej nigdy nie czyta
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

**How to apply:** Przy każdym wymaganiu dotyczącym uprawnień pytaj osobno „czy macierz to mówi"
i „czy jakikolwiek kod to czyta" — to dwa różne stany i pierwszy bywa zielony przy drugim
pustym. Jeżeli kiedyś powstanie WO na regułę skanu (Server Action mutująca zasób z `RESOURCES`
bez wywołania `can()`), obowiązuje [[gate-rule-liveness]]: reguła wchodzi razem ze stałą mutacją
w `kk-selftest.mjs`. Sam skan to narzędzie, nie kontrakt — nie dokładaj go przy okazji zmiany
w `contracts/`.
