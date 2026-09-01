> ⚠️ **NIEAKTUALNY — ZASTĄPIONY 2026-08-26 przez `docs/workorders/SEC-AUTHZ-B2B-MUTATIONS.md`.**
> Ten WO opisywał 5 ścieżek DELETE. Skaner `tools/kk-authz-gate.mjs` wykazał **14 mutacji Prismy
> bez bramki `can()` w 6 plikach** — te same 5 plus 9 mutacji nie-DELETE, w tym dwie w
> `leads/actions.ts` (`updateLeadStatus`, `advanceLeadStatus`). Nie implementować z tego pliku.
> Zachowany dla dwóch analiz, do których nowy WO odsyła: warstwa RLS (deny-by-default, brak polityk
> `FOR DELETE`) oraz sprzeczność `ANONYMIZE_OR_SET_NULL` ↔ twardy `prisma.klienci.delete`.

# WO: CRM-DELETE-ADMIN-ONLY — pozostałe ścieżki usuwania w CRM (klienci, instalacje, serwisy, usterki + logistyka)

## Wymagania: CRM-DELETE-ADMIN-ONLY (status TODO, risk HIGH)

Treść wymagania (`contracts/requirements.contract.mjs:69`):
> „Akcja »Usuń« we WSZYSTKICH 7 widokach CRM dostępna wyłącznie dla roli admin."
> acceptance: `Ukryta w UI dla ról nie-admin`, `Server Action odrzuca żądanie roli nie-admin`,
> `RLS odrzuca DELETE roli nie-admin`, `Test sprawdza wszystkie trzy warstwy osobno`.

Źródło: `docs/architecture/b2b_crm_specifications.md:6` (nagłówek „Globalne Uprawnienie Usuwania")
oraz punkty per-widok: `:32` klient, `:61` instalacja, `:89` wpis serwisowy, `:114` usterka,
`:143` audytor, `:173` zespół, `:203` lead. To są te „7 widoków" — lista potwierdzona w dokumencie,
nie zgadywana.

## Kontekst kodu

### Istnieje (domknięte wcześniej — wzorzec do skopiowania)
- `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:490` `deleteLeadAction` — `getCurrentActorRole()` + `can(actorRole,'leads','delete') !== 'yes'`, fail-closed na `!actorRole`; test `apps/b2b-web/tests/leads-delete-admin-only.test.ts`.
- `apps/b2b-web/src/app/(dashboard)/crews/actions.ts:192` `deleteCrewAction` — bramka roli + `BLOCK_UNTIL_REASSIGNED` w jednej transakcji; test `apps/b2b-web/tests/crews-admin-gates.test.ts`.
- `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts:201` `deleteAuditorAction` — bramka roli obecna (linia 202); test `apps/b2b-web/tests/auditors-delete.test.ts`.
- Warstwa UI ma już wzorzec: `auditors/page.tsx:8` przekazuje `actorRole` do klienta, a `auditors-client.tsx:39` liczy `canDeleteAuditors = can(actorRole,'auditors','delete') === 'yes'` i warunkuje pozycję menu (`:161`). To samo w `leads-client.tsx:143,416,527`.
- Warstwa RLS: `supabase/migrations/20260824185845_security_enable_rls_baseline.sql` włącza RLS na `klienci` (`:138`), `leady` (`:148`), `instalacje` (`:70`), `serwisy` (`:71`), `usterki_incidents` (`:72`), `logistyka_zamowienia` (`:76`) i **nie tworzy żadnej polityki `FOR DELETE`** — czyli DELETE przez klucz anon/authenticated jest dziś odrzucany deny-by-default. Migracja NIE wymaga zmiany; wymaga natomiast testu, który to zamrozi.

### Brakuje — pięć ścieżek DELETE bez jakiegokolwiek sprawdzenia roli
Wszystkie pięć wołają `prisma.*.delete()` jako pierwszą instrukcję ciała funkcji. Prisma omija RLS,
więc bramka Server Action jest tu **jedyną** granicą uprawnień.

| # | Plik : linia | Funkcja | Tabela | Zasób RBAC | Wymagana rola (`contracts/rbac.contract.mjs`) | Bramka dziś | Test dziś |
|---|---|---|---|---|---|---|---|
| 1 | `customers/actions.ts:48` | `deleteCustomerAction` | `klienci` | `clients` | `delete: ['admin']` (`:29`) | brak | brak |
| 2 | `installations/actions.ts:86` | `deleteInstallationAction` | `instalacje` | `installations` | `delete: ['admin']` (`:32`) | brak | brak |
| 3 | `services/actions.ts:49` | `deleteServiceAction` | `serwisy` | `services` | `delete: ['admin']` (`:33`) | brak | brak |
| 4 | `incidents/actions.ts:40` | `deleteIncidentAction` | `usterki_incidents` | `incidents` | `delete: ['admin']` (`:34`) | brak | brak |
| 5 | `logistics/actions.ts:163` | `deleteLogisticsOrderAction` | **`leady`** | `leads` | `delete: ['admin']` (`:30`) | brak | brak |

Ścieżka nr 5 to **obejście już naprawionej bramki**: kasuje rekord z `leady`, czyli robi dokładnie to,
co `deleteLeadAction`, tylko bez sprawdzenia roli. Dopóki istnieje, naprawa leadów jest pozorna.

Warstwa UI — żaden z pięciu widoków nie zna roli aktora:
- `customers/page.tsx:9`, `installations/page.tsx:9`, `services/page.tsx:8`, `incidents/page.tsx:8`, `logistics/page.tsx:9` — brak `getCurrentActorRole()`, brak propsa `actorRole`.
- `customers-client.tsx:28`, `installations-client.tsx:28`, `services-client.tsx:37`, `incidents-client.tsx:37`, `logistics-client.tsx:26` — pozycja „Usuń" renderowana bezwarunkowo; UI dodatkowo pokazuje `alert("… został usunięty")` niezależnie od wyniku, bo akcje zwracają `void`.

Pokrycie (`node tools/kk-trace.mjs`): `CRM-DELETE-ADMIN-ONLY` figuruje jako pokryty, ale wyłącznie
plikami `crews-admin-gates.test.ts` i `leads-delete-admin-only.test.ts`. Trace liczy referencje do ID,
nie zasoby — **zielony wpis w trace nie oznacza pokrycia pozostałych pięciu ścieżek**.

## Zmiana kontraktu
**NIEWYMAGANA.** Wymaganie jest w rejestrze, `MATRIX` ma `delete: ['admin']` dla wszystkich pięciu
zasobów, RLS jest już deny-by-default, schemat nie jest dotykany. To czysta implementacja + testy,
1:1 wzorem `deleteLeadAction`. Okno kontraktowe nie jest potrzebne.

Wyjątek — patrz „Ryzyka": strategia usuwania klienta (`ANONYMIZE_OR_SET_NULL`) jest sprzeczna
z kodem i z dokumentem. To **osobna** decyzja, nie warunek tego WO; tu domykamy wyłącznie bramkę roli.

## Podział na etapy (rekomendacja)
Zakres to 5 akcji × 3 warstwy. To nie zmieści się w jednej pętli GREEN (limit 3 iteracje).
Kolejność wymuszona: Etap 1 zamyka podatność, Etap 2 jest kosmetyką bezpieczeństwa i może poczekać.

- **Etap 1 (start teraz)**: AC1–AC6 — bramka Server Action + testy jednostkowe per akcja.
- **Etap 2 (osobna pętla)**: AC7–AC10 — ukrycie akcji w UI + zamrożenie warstwy RLS.

## Kryteria akceptacji (wykonalne)

### Etap 1 — warstwa Server Action
- [ ] AC1: Wywołanie każdej z pięciu akcji (`deleteCustomerAction`, `deleteInstallationAction`, `deleteServiceAction`, `deleteIncidentAction`, `deleteLogisticsOrderAction`) przez konto o roli `dyspozytor`, `audytor` albo `monter` nie usuwa rekordu — test dowodzi, że odpowiedni `prisma.*.delete` **nie został w ogóle wywołany**, a nie tylko że rekord istnieje.
- [ ] AC2: Ta sama akcja wywołana przez `admin` usuwa rekord (`delete` wywołane dokładnie raz z `where: { id }`) — bramka nie blokuje uprawnionego.
- [ ] AC3: Brak sesji / `getCurrentActorRole()` zwraca `null` → odmowa (fail-closed), nie wyjątek i nie usunięcie.
- [ ] AC4: Rola pochodzi wyłącznie z sesji serwera; przekazanie roli w argumencie akcji nie zmienia decyzji (test wywołuje akcję bezpośrednio, z pominięciem UI — UI nie jest granicą uprawnień, bo Prisma omija RLS).
- [ ] AC5: Decyzję podejmuje `can(actorRole, <zasób>, 'delete')` z `@klikklima/contracts` dla zasobu zgodnego z tabelą (`clients`, `installations`, `services`, `incidents`, **`leads`** dla logistyki) — nie literał `'admin'` i nie inna zdolność (`update`). Test odróżnia to jawnie: `dyspozytor` ma `update` na `installations`/`services`/`incidents`/`clients`/`leads`, ale nie ma `delete`; naprawa oparta przez pomyłkę na `update` musi ten zestaw oblać.
- [ ] AC6: Odmowa jest dla wywołującego rozróżnialna od sukcesu — akcja zwraca wynik (`{ success: false, error }`), a nie `void`, i UI nie pokazuje komunikatu „usunięto" po odmowie.

### Etap 2 — UI i RLS
- [ ] AC7: Zalogowany `dyspozytor`/`audytor`/`monter` nie widzi pozycji „Usuń" w menu wiersza w widokach klienci, instalacje, serwisy, usterki i logistyka; `admin` ją widzi.
- [ ] AC8: Widoczność liczona jest z `can(actorRole, …, 'delete')`, a `actorRole` pochodzi z `getCurrentActorRole()` w Server Component strony (wzorzec `auditors/page.tsx:8` → `auditors-client.tsx:39`), nie z wartości trzymanej w kliencie.
- [ ] AC9: Test warstwy RLS dowodzi, że w migracjach nie istnieje żadna polityka `FOR DELETE`/`FOR ALL` dla `klienci`, `instalacje`, `serwisy`, `usterki_incidents`, `leady`, `logistyka_zamowienia` — czyli DELETE przez klucz anon/authenticated pozostaje odrzucone. Dodanie takiej polityki w przyszłości ma ten test oblać.
- [ ] AC10: Trzy warstwy są testowane w osobnych blokach/plikach (wymóg acceptance nr 4 z rejestru) — jeden test nie może „zaliczać" dwóch warstw naraz.

## Przypadki brzegowe, które MUSZĄ mieć test
- **Uprawnienia (rdzeń)**: pełna macierz 4 role × 5 akcji. `dyspozytor` jest najgroźniejszy — ma `update` na tych zasobach, więc naiwna naprawa go przepuści.
- **Fail-closed**: `getCurrentActorRole()` zwraca `null` albo rzuca (brak wiersza w `authorized_users`, wygasła sesja) → odmowa, nie awaria w tryb otwarty.
- **Obejście przez inny widok**: `deleteLogisticsOrderAction` kasuje `leady`. Test musi jawnie stwierdzić, że po naprawie NIE istnieje druga, niebramkowana ścieżka usunięcia leada (dziś jedyne dwa wywołania `prisma.leady.delete` to `leads/actions.ts:497` i `logistics/actions.ts:164`).
- **Idempotencja / rekord nieistniejący**: usunięcie nieistniejącego `id` przez admina nie może kończyć się nieobsłużonym wyjątkiem Prisma (`P2025`) wyciekającym do UI; dla nie-admina odmowa musi wystąpić **przed** zapytaniem do bazy, więc nie może zależeć od istnienia rekordu (inaczej akcja staje się oraklem istnienia rekordów).
- **Klucze obce**: `klienci` i `instalacje` mają rekordy zależne. Odmowa z powodu FK musi być odróżnialna od odmowy z powodu roli — inaczej pierwszy komunikat maskuje drugi (dziś `customers-client.tsx:31` tłumaczy KAŻDY wyjątek na „blokują go klucze obce", łącznie z przyszłym brakiem uprawnień).
- **Współbieżność**: nie dotyczy tych pięciu akcji w takim stopniu jak `deleteCrewAction` (brak reguły `BLOCK_UNTIL_REASSIGNED` dla tych encji), ale jeżeli implementer doda sprawdzenie warunku przed DELETE, musi ono trafić do tej samej transakcji co DELETE.

## Poza zakresem
- Zmiana strategii usuwania klienta na `ANONYMIZE_OR_SET_NULL` (`DELETE_POLICIES`, `rbac.contract.mjs:103`). Osobne WO, osobne okno kontraktowe — patrz „Ryzyka".
- Wpis do `audit_log` przy usunięciu (`AUDIT_REQUIREMENTS.mustLog` zawiera `'delete'`). Tabela `audit_log` nie istnieje w schemacie; jej dodanie to zmiana kontraktu+migracji, nie ten WO.
- Kaskady dla `leads` (`cascades: ['quotes','shipments']`) — tabela `quotes` nie istnieje.
- Refaktor `deleteLogisticsOrderAction` do wywołania `deleteLeadAction` / decyzja, czy widok logistyki w ogóle powinien kasować leada. Tu tylko zakładamy bramkę.
- Widoki audytorów, zespołów i leadów — domknięte wcześniej, nie ruszać.
- Twarde usuwanie po stronie B2C i `authorized_users` (`SEC-AUTHZ-USER-MGMT`, odrębne wymaganie, już pokryte).

## Ryzyka i nieznane
- **RYZYKO HIGH — nieodwracalne usuwanie danych klienta.** Dziś dowolne zalogowane konto (`monter` włącznie) może przez `deleteCustomerAction` skasować rekord klienta z bazy produkcyjnej. To dane osobowe i podstawa historii finansowej montaży; nie ma `audit_log`, więc po fakcie nie da się ustalić, kto to zrobił. Ta sama klasa błędu co naprawiony `deleteCrewAction`, tylko z gorszym skutkiem.
- **Sprzeczność kontrakt ↔ kod ↔ dokument (nie blokuje tego WO, ale wymaga decyzji osobno):**
  - `contracts/rbac.contract.mjs:103`: `{ entity: 'clients', strategy: 'ANONYMIZE_OR_SET_NULL', rationale: 'RODO bez utraty historii finansowej montażu.' }`
  - `docs/architecture/b2b_crm_specifications.md:32`: „🚨 `Usuń klienta` (Tylko dla roli Administrator – twarde usunięcie / usunięcie zgodne z RODO)" — spójnik „/" nie rozstrzyga, która ze strategii obowiązuje.
  - `apps/b2b-web/src/app/(dashboard)/customers/actions.ts:53`: `prisma.klienci.delete(...)`, czyli twarde usunięcie, wprost wbrew kontraktowi. Komentarz nad kodem sam przyznaje, że „na razie polegamy na constraintach".
  - **WYMAGA DECYZJI (osobne WO, nie warunek tego): czy `deleteCustomerAction` ma zostać twardym DELETE (wtedy trzeba poprawić `DELETE_POLICIES`), czy przejść na anonimizację (wtedy trzeba zmienić kod i schemat).** Bramka roli jest potrzebna w obu wariantach, więc ten WO można wykonać, nie czekając na tę decyzję.
- **Nieznane — `logistics`:** widok logistyki nie jest jednym z „7 widoków CRM" wymienionych w `b2b_crm_specifications.md`, ale jego akcja usuwa dokładnie tę encję (`leady`), którą wymaganie chroni. Traktuję ją jako objętą zakresem, bo inaczej wymaganie jest obchodzone jednym kliknięciem. Jeżeli człowiek zdecyduje inaczej, ścieżkę nr 5 należy usunąć z kodu, a nie zostawić bez bramki.
- **Nieznane — widok `faults`:** `apps/b2b-web/src/app/(dashboard)/faults/` ma samo `page.tsx`, bez `actions.ts`. Nie ma tam żadnej ścieżki usuwania, więc nie dotyczy. Jeżeli `faults` i `incidents` to ten sam widok domenowy w dwóch katalogach, to osobny dług, nie ten WO.
- **Trace kłamie w tę stronę:** `kk-trace.mjs` dopasowuje ID wymagania w komentarzach testów, więc wymaganie o zakresie „7 widoków" pokazuje się jako pokryte po naprawieniu dwóch. Po tym WO warto rozważyć rozbicie wymagania na per-zasobowe ID — inaczej ta sama pułapka wróci.

---

## Aktualizacja 2026-09-01 — rozbicie na ID per zasób (WO BATCH-MEDIUM-LOW-CLEANUP, punkt 22)

`CRM-DELETE-ADMIN-ONLY` ma odtąd status `SUPERSEDED`. Zostaje w rejestrze (historia + dopasowania
`kk-trace` do już otagowanych testów), ale pokrycie liczy się wyłącznie na wpisach potomnych.

Liczba widoków **policzona ręcznie** po ścieżkach `prisma.<tabela>.delete` / `tx.<tabela>.delete`
w `apps/b2b-web/src/app/(dashboard)/**/actions.ts` — wychodzi 7, czyli liczba z treści starego
wymagania okazała się poprawna (ale sprawdzona, nie przyjęta na wiarę).

| Nowe ID | Zasób (RESOURCES) | Tabela | Plik akcji | Status |
|---|---|---|---|---|
| `CRM-DELETE-ADMIN-ONLY-CLIENTS` | `clients` | `klienci` | `customers/actions.ts` | TODO |
| `CRM-DELETE-ADMIN-ONLY-LEADS` | `leads` | `leady` | `leads/actions.ts` | TODO |
| `CRM-DELETE-ADMIN-ONLY-INSTALLATIONS` | `installations` | `instalacje` | `installations/actions.ts` | TODO |
| `CRM-DELETE-ADMIN-ONLY-SERVICES` | `services` | `serwisy` | `services/actions.ts` | TODO |
| `CRM-DELETE-ADMIN-ONLY-INCIDENTS` | `incidents` | `usterki_incidents` | `incidents/actions.ts` | TODO |
| `CRM-DELETE-ADMIN-ONLY-AUDITORS` | `auditors` | `audytorzy` | `auditors/actions.ts` | TODO |
| `CRM-DELETE-ADMIN-ONLY-CREWS` | `crews` | `zespoly_monterskie` | `crews/actions.ts` | TODO |

**Ósma ścieżka kasująca** (`settings/actions.ts` → `prisma.authorizedUser.delete` → zasób
`authorized_users`) **nie jest widokiem CRM** i ma własne wymaganie `SEC-AUTHZ-USER-MGMT`.
Świadomie poza tym rozbiciem.

### Dlaczego wszystkie siedem jest `TODO`, a nie `DONE`

Warstwa **RLS** nie jest dziś pokryta dla ŻADNEGO z siedmiu zasobów — brak środowiska Postgres
(ta sama blokada co `FLD-CONSENT-TRIGGERS-INTEGRATION`). Warstwa **UI** (ukrycie akcji dla ról
nie-admin) też nie ma testu. Pokryta jest wyłącznie warstwa Server Action, i to tylko dla dwóch
zasobów: `leads` (`leads-delete-admin-only.test.ts`) i `crews` (`crews-admin-gates.test.ts`).

To jest dokładnie ta różnica, którą wpis zbiorczy ukrywał: dwa widoki z siedmiu, jedna warstwa
z trzech, a `kk-trace` pokazywał wymaganie jako pokryte.
