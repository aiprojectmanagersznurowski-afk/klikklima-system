---
name: authz-gate-coverage-gap
description: Retrofit sprawdzania ról w panelu B2B raz po raz miał dziurę tam, gdzie kończyła się definicja bramki — macierz RBAC poprawna przy kodzie, który jej nie czyta; pięć wystąpień, ostatnie w kryterium samego skanera
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

Czwarte wystąpienie (2026-08-25, `CRM-LEAD-UPDATE-ADMIN-DISPATCHER`): luka siedziała w pliku
BLIŹNIACZYM wobec już naprawionego — `leads/actions.ts` sprawdza rolę w trzech akcjach,
a `leads/[id]/actions.ts` w żadnej z trzech. Retrofit szedł po plikach otwartych w review, nie po
zasobach z macierzy, więc segment ścieżki (`[id]/`) wystarczył, żeby plik wypadł z zakresu.
Przy tej okazji: zdolność `assign` istnieje w `Capability` i w macierzy (`leads.assign = [admin]`,
`bookings.assign`), ale ŻADEN kod w repo nie woła `can()` z tą zdolnością — przypisania idą przez
`update`, co przy `leads` daje inny zestaw ról (admin+dyspozytor) niż `assign` (admin). To otwarte
pytanie dla człowieka, nie defekt do cichej naprawy podmianą argumentu.

**Detektor istnieje od 2026-08-26:** `tools/kk-authz-gate.mjs` (AST po `typescript`) skanuje
`apps/b2b-web/**/actions.ts` i zgłasza eksportowane funkcje, które mutują przez Prismę
(w tym przez `tx.` w `$transaction`) bez pary `getCurrentActorRole()` + `can()`. Wyjątek:
`// AUTHZ-EXEMPT: <powód>` nad definicją. Liczy per funkcja, nie per plik — czyli łapie
przypadek z akapitu trzeciego. Pierwsze uruchomienie: 14 podejrzanych z 33 funkcji mutujących.
ŚWIADOMIE NIE podpięty do `scripts/verify.sh` — repo ma nienaprawiony dług, a bramka czerwona
od pierwszego dnia nie niesie sygnału. Podpięcie dopiero po zamknięciu długu albo po dodaniu
baseline'u wzorem `kk-naming.mjs`; wtedy obowiązuje [[gate-rule-liveness]].

**Dług warstwy Server Action zamknięty 2026-08-26** — wszystkie 14 znalezisk naprawione,
zarejestrowane RETROAKTYWNIE jako `SEC-AUTHZ-B2B-MUTATIONS` (status `DONE`, 6 plików testów).
Kolejność „implementacja i testy najpierw, ID wymagania po fakcie" była w tym przypadku
świadomą decyzją człowieka, nie obejściem procesu: skaner znalazł lukę bezpieczeństwa, a nie
brak wpisu w rejestrze. Wpis wiąże regułę z tabelą docelową zapisu, nie z nazwą funkcji —
poprzednie trzy wymagania zawężone do konkretnych akcji zostawiały dziurę przy czwartej.
Podpięcie skanera do `scripts/verify.sh` jest teraz możliwe (baseline byłby pusty), ale
pozostaje niezrobione. Warstwa UI i RLS z tego WO nadal otwarte.

**Piąte wystąpienie, tym razem w kształcie samego detektora (2026-09-03, WO `SEC-READ-GATES`):**
skaner z definicji liczył wyłącznie MUTACJE, więc siedem eksportowanych funkcji ODCZYTOWYCH bez
`can()` (`getCustomers`, `getCrews` ×2, `getAuditors`, `getInstallations`, `getUpcomingServices`,
`getIncidents`) świeciło na zielono, wystawiając PII wszystkich klientów każdemu zalogowanemu.
Ósmy przypadek, `customers/[id]/page.tsx`, wołał Prismę WPROST ze strony i wymykał się drugiemu
kryterium („plik nazywa się `actions.ts`"). Nauka ogólniejsza niż ten commit: **kryterium bramki
samo jest powierzchnią ataku** — luka wchodzi dokładnie tam, gdzie skaner ma granicę definicji,
a zielony wynik mówi tylko tyle, ile obejmuje definicja. Przy każdej bramce czytaj najpierw jej
sekcję ograniczeń, potem wynik. Od tego commita skaner obejmuje odczyty (`findMany`/`findUnique`/
`findFirst`/`count`/`groupBy`/`aggregate`/`$queryRaw`, dla samego odczytu warunkiem jest samo
`can(`) i wszystkie `.ts`/`.tsx` pod `apps/b2b-web/src/app`. NADAL poza zakresem: `src/lib/`,
`src/utils/`, `packages/`, `export const x = async () => …`.

**Skaner nie ma własnego selftestu.** `kk-selftest.mjs` mutuje kontrakt, nie kod aplikacji, więc
żywotność `kk-authz-gate` dowodzi się doraźnie (usuń `can()`, uruchom, przywróć) — czyli dokładnie
tym trybem, który [[gate-rule-liveness]] odrzuca dla `kk-validate`. To znana, otwarta dziura:
gdyby ktoś zepsuł heurystykę AST, bramka świeciłaby na zielono i nikt by się nie dowiedział.

Czego detektor NIE dowodzi: że bramka jest POPRAWNA. `can(role, 'leads', 'update')` w akcji
kasującej klienta przechodzi skan. Para zasób/zdolność zostaje sprawą review i testów.

**How to apply:** Przy każdym wymaganiu dotyczącym uprawnień pytaj osobno „czy macierz to mówi"
i „czy jakikolwiek kod to czyta" — to dwa różne stany i pierwszy bywa zielony przy drugim
pustym. Dziś na drugie pytanie odpowiada `node tools/kk-authz-gate.mjs`; uruchom go, zanim
uznasz jakikolwiek retrofit uprawnień za domknięty. Sam skan to narzędzie, nie kontrakt —
nie dokładaj go przy okazji zmiany w `contracts/`.
