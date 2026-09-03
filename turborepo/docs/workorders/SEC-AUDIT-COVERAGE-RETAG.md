# WO: SEC-AUDIT-COVERAGE-RETAG — pokrycie CRM-DELETE-ADMIN-ONLY-CLIENTS / SEC-RODO-DELETE / SEC-AUDIT-LOG

## Wymagania: CRM-DELETE-ADMIN-ONLY-CLIENTS, SEC-RODO-DELETE, SEC-AUDIT-LOG
Pomocniczo zbadane: SEC-AUDIT-LOG-APPEND-ONLY (`contracts/requirements.contract.mjs:177`), CRM-CLIENT-ANONYMIZE-RODO (`:176`).

## Kontekst kodu

**Istnieje:**
- `apps/b2b-web/tests/customers-anonymize-rodo.test.ts` — 28 bloków `it`, wszystkie otagowane `@REQ: CRM-CLIENT-ANONYMIZE-RODO`. Pokrywa: bramkę roli liczonej z `can(role,'clients','delete')`, fail-closed na braku roli/sesji/e-maila, walidację `justification` (granica 9/10 po trim) i `legalBasis` z `AUDIT_REQUIREMENTS.legalBases`, payloady `klienci.updateMany` / `adresy.updateMany`, treść wpisu `auditLog.create`, kolejność w jednej transakcji, idempotencję (`count: 0`), współbieżność (proxy strukturalny na `where.anonymized_at: null`), atomowość (pośrednio, przez brak `revalidatePath`), testy statyczne na `klienci.delete` i `deleteCustomerAction`.
- `apps/b2b-web/tests/customers-anonymize-ui.test.ts` — 18 bloków `it`, ten sam tag. Pokrywa widoczność pozycji menu „Anonimizuj (RODO)" liczoną z `can(...)`, zanik etykiety „Usuń (Tylko Admin)", schemat formularza, `disabled={!isValid`, brak zgadywania `legalBases[0]`.
- `apps/b2b-web/tests/rls-deny-by-default-freeze.test.ts` — statyczne zamrożenie `20260824185845_security_enable_rls_baseline.sql`: RLS włączone na `klienci`, zero polityk `FOR SELECT`. Otagowane `@REQ: SEC-RLS-AUDITOR-SCOPE`.
- `supabase/migrations/20260901220000_rodo_audit_log_and_client_anonymization.sql` — tabela `audit_log`, CHECK-i na `operation`/`resource`/`legal_basis`/`justification`, `ENABLE ROW LEVEL SECURITY`, funkcja `public.audit_log_append_only()` i wyzwalacz `audit_log_append_only_trg`. Migracja **nie jest uruchomiona na żywej bazie**.
- `contracts/rbac.contract.mjs:41` — `MATRIX` dla `audit_log` ma `update: []`, `delete: []`.
- Wzorzec testu statycznego nad migracją, gotowy do skopiowania: `apps/b2b-web/tests/fld-consent-docs-migration-static.test.ts` (dowodzi m.in. obecności `employee_consents_append_only()` i triggera BEFORE UPDATE).

**Brakuje (zweryfikowane grepem, nie założone):**
- **Żaden plik testowy w repozytorium nie odwołuje się do migracji `20260901220000`.** `grep -rn "20260901220000" apps/ examples/ --include=*.ts` → zero trafień. Nie istnieje też żadna asercja na literał `audit_log_append_only_trg` (jedyne dwa wystąpienia tego literału w testach to komentarze w nagłówku `customers-anonymize-rodo.test.ts`, linie 12 i 76).
- **Nagłówek `customers-anonymize-rodo.test.ts` (linie 13–14 i 76) twierdzi nieprawdę:** „AC9 (append-only, warstwa bazy) jest POZA ZAKRESEM tego pliku — pokryte gdzie indziej w poprzedniej turze". Nie jest pokryte nigdzie. To zgłoszenie dla `reviewer` — komentarz w teście, który uspokaja fałszywie, jest gorszy niż brak komentarza.
- Zapisu do `audit_log` dla pięciu z sześciu operacji `AUDIT_REQUIREMENTS.mustLog`. Zaimplementowana i przetestowana jest wyłącznie `anonymize`. `apps/b2b-web/tests/settings-authorized-users.test.ts:52-53` odracza `role_change` wprost: „Kryterium audit_log / role_change […] świadomie pominięte, pokrywa je SEC-AUDIT-LOG, osobny wymóg".
- Asercji wykluczającej politykę RLS `FOR DELETE` / `FOR ALL` na `klienci` (istniejąca liczy wyłącznie `FOR SELECT`).
- Kolumny `before_snapshot` w modelu `AuditLog` — nie istnieje i istnieć nie może (patrz „Ryzyka").
- Tabeli faktur w `packages/database/prisma/schema.prisma` — brak jakiegokolwiek modelu `faktury`/`invoice`.

## Zmiana kontraktu
**WYMAGANA — ale nie w tej turze i nie przeze mnie.** Trzy rozłączne pozycje dla `contract-steward`, każda wymaga otwartego okna kontraktowego i zgody człowieka:

1. `SEC-RODO-DELETE` AC3 (`before_snapshot`) jest **nierealizowalne przy obecnym schemacie i sprzeczne z `CRM-CLIENT-ANONYMIZE-RODO` AC10**. Patrz „Ryzyka i nieznane" — to jest blokada decyzyjna, nie zadanie.
2. `CRM-DELETE-ADMIN-ONLY-CLIENTS` — kandydat do `status: 'SUPERSEDED'` na rzecz `CRM-CLIENT-ANONYMIZE-RODO`, wzorem `CRM-DELETE-ADMIN-ONLY` (`:162`). **Rekomendacja: NIE teraz** — patrz AC3 poniżej, jedna warstwa nie jest jeszcze dowiedziona, a `SUPERSEDED` zamknęłoby ją bez dowodu.
3. `SEC-AUDIT-LOG` — **nie zastępować**. Jego zakres (sześć operacji) jest istotnie szerszy niż `CRM-CLIENT-ANONYMIZE-RODO` (jedna operacja). Oznaczenie go `SUPERSEDED` skasowałoby z rejestru pięć nieudowodnionych operacji.

## Kryteria akceptacji (wykonalne)

### Blok A — `CRM-DELETE-ADMIN-ONLY-CLIENTS`: dopisanie tagów (dla `test-author`)
Do wymienionych bloków `it` dopisać **dodatkowy** komentarz `// @REQ: CRM-DELETE-ADMIN-ONLY-CLIENTS` **obok** istniejącego `@REQ`, nie zamiast niego. Numery linii wg stanu na 2026-09-03.

- [ ] A1: warstwa UI — `apps/b2b-web/tests/customers-anonymize-ui.test.ts:82`, `:97`, `:119`, `:363`.
      Dowód dla AC „UI: akcja «Usuń» jest ukryta dla ról dyspozytor, audytor i monter": `:363` liczy zbiór ról dynamicznie z `can(r,'clients','delete')` i asertuje `isAnonymizeMenuItemVisible(role) === false` dla każdej roli spoza niego; `:119` wiąże tę funkcję z faktycznym renderem etykiety w `customers-client.tsx` (asercja na `isAnonymizeMenuItemVisible( actorRole )` w oknie 600 znaków przed etykietą), więc dowód nie jest „funkcja gdzieś istnieje".
- [ ] A2: warstwa Server Action — `apps/b2b-web/tests/customers-anonymize-rodo.test.ts:166`.
      Dowód dla AC „test dowodzi, że `prisma.klienci.updateMany` nie zostało wywołane": `it.each(DELETE_DENIED_ROLES)` z asercją `expect(txKlientUpdateManyMock).not.toHaveBeenCalled()` (linia 179) plus `transactionMock` niewołane (178). Uzupełniająco `:187` (rola `null`) i `:201` (wyjątek z `getCurrentActorRole` → komunikat pasujący do `/uprawn/i`, nie generyczny błąd zapisu).
- [ ] A3: warstwa RLS — **brak dowodu, tag do dopisania dopiero po nowym teście.** `rls-deny-by-default-freeze.test.ts:70` (blok `klienci`) asertuje wyłącznie obecność `FOR INSERT TO anon` i `zero` wystąpień `FOR SELECT`. Polityka `FOR DELETE` albo `FOR ALL` dopisana do tego samego bloku przeszłaby wszystkie dzisiejsze asercje. **Nowy test (jeden `it`)**: w bloku `public.klienci` w `20260824185845_security_enable_rls_baseline.sql` liczba wystąpień `FOR DELETE` oraz `FOR ALL` wynosi zero, a w całym pliku żadna polityka `FOR DELETE`/`FOR ALL` nie wskazuje na `public.klienci`. Dopiero ten `it` niesie `@REQ: CRM-DELETE-ADMIN-ONLY-CLIENTS`.
- [ ] A4: po A1–A3 `node tools/kk-trace.mjs` pokazuje `CRM-DELETE-ADMIN-ONLY-CLIENTS` jako pokryte przez co najmniej trzy różne pliki testowe.

### Blok B — `SEC-AUDIT-LOG`: tagi częściowe + jawnie nazwana luka
- [ ] B1: dopisać `// @REQ: SEC-AUDIT-LOG` do `customers-anonymize-rodo.test.ts:399` (AC „actor_role zapisuje rolę z chwili operacji" — asercja `actorRole: 'admin'`, wartość pochodzi z `getCurrentActorRoleMock`, nie z relacji), `:324` i `:338` (AC „legal_basis pochodzi z zamkniętej listy" — odrzucenie `NOT_A_REAL_LEGAL_BASIS` i `it.each` po całym `AUDIT_REQUIREMENTS.legalBases`), `:273`/`:284`/`:296` (AC „justification jest wymagane", z granicą 9/10 po trim), `:654` (AC „before_snapshot nie zawiera danych osobowych w postaci jawnej" — model `AuditLog` nie ma ŻADNEJ kolumny o nazwie pola PII), `:558` i `:575` (AC „wycofanie transakcji wycofuje też wpis audytowy", dowód pośredni: `revalidatePath` poza transakcją nie jest wołane).
- [ ] B2: **nie dopisywać tagu** przy AC „każda z sześciu operacji `mustLog` tworzy wpis w tej samej transakcji". Pokryta jest jedna operacja (`anonymize`). Pięć pozostałych — `delete`, `role_change`, `contract_override`, `manual_status_change`, `notification_resend` — nie ma ani implementacji, ani testu. To osobny Work Order, nie retagowanie.
- [ ] B3: **nie dopisywać tagu** przy AC „RLS odrzuca UPDATE i DELETE na audit_log dla wszystkich ról łącznie z admin — test wykonuje obie próby jako admin". Wymaga żywego Postgresa; w tym środowisku niewykonalne.

### Blok C — `SEC-AUDIT-LOG-APPEND-ONLY` (poza zakresem tej tury, ale to jedyna realna luka o zerowym pokryciu)
- [ ] C1: cztery z sześciu AC są dziś wykonalne testem statycznym nad `20260901220000_rodo_audit_log_and_client_anonymization.sql`, wzorem `apps/b2b-web/tests/fld-consent-docs-migration-static.test.ts`: obecność `CREATE OR REPLACE FUNCTION public.audit_log_append_only()`, triggera `audit_log_append_only_trg`, `ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY`, zera polityk `FOR UPDATE`/`FOR DELETE`/`FOR ALL` na `audit_log`, oraz czterech CHECK-ów.
- [ ] C2: AC „MATRIX dla zasobu audit_log ma `update: []` i `delete: []`" jest wykonalne dziś w czystym JS, bez bazy — asercja na `MATRIX` z `@klikklima/contracts`.
- [ ] C3: usunąć z `customers-anonymize-rodo.test.ts` (linie 13–14 i 76) twierdzenie, że AC9 jest „pokryte gdzie indziej". Zgłoszenie dla `reviewer`; `test-author` może to zrobić przy okazji Bloku A/B, bo to jego plik.

## Przypadki brzegowe, które MUSZĄ mieć test
- Dopisanie polityki RLS `FOR DELETE`/`FOR ALL` na `klienci` musi zapalić czerwone (dziś nie zapala) — Blok A3.
- Dopisanie polityki `FOR UPDATE`/`FOR DELETE` na `audit_log` musi zapalić czerwone (dziś nie zapala) — Blok C1.
- Nadanie komukolwiek `update`/`delete` na `audit_log` w `MATRIX` musi zapalić czerwone — Blok C2.
- Retag nie może zmienić ANI JEDNEJ asercji. Jeżeli po dopisaniu tagów którykolwiek test zmienia wynik, to znaczy, że dopisano coś więcej niż komentarz.
- Idempotencja retagu: `kk-trace` zlicza wystąpienia tagów, nie unikalne bloki — podwójne `@REQ` w jednym bloku `it` nie może być błędem walidacji.

## Poza zakresem
- Implementacja zapisu `audit_log` dla `delete`, `role_change`, `contract_override`, `manual_status_change`, `notification_resend`.
- Uruchomienie migracji `20260901220000` na żywej bazie (wymaga jawnej zgody człowieka).
- Testy integracyjne na żywym Postgresie — brak Dockera/psql w tym środowisku.
- CRM-DELETE-ADMIN-ONLY-LEADS/-INSTALLATIONS/-SERVICES/-INCIDENTS/-AUDITORS/-CREWS oraz SEC-SSO-GUARD. To **nie jest** to samo zjawisko: dotyczą innych zasobów, dla których nie istnieje odpowiednik `CRM-CLIENT-ANONYMIZE-RODO` niosący ich kryteria pod innym tagiem. Ich brak pokrycia jest prawdziwy, nie księgowy.
- Jakakolwiek zmiana w `contracts/`.

## Ryzyka i nieznane

**WYMAGA DECYZJI: `SEC-RODO-DELETE` AC3 jest sprzeczne z `CRM-CLIENT-ANONYMIZE-RODO` AC10 — nie da się spełnić obu.**

- `contracts/requirements.contract.mjs:309`, `SEC-RODO-DELETE`, kryterium 3: „Migawka **before_snapshot** ma dane kontaktowe już zanonimizowane". Źródło: `database_model.md#4`.
- `contracts/requirements.contract.mjs:176`, `CRM-CLIENT-ANONYMIZE-RODO`, kryterium 10: „Test statyczny: **żadna funkcja w repozytorium nie przechowuje kopii danych osobowych klienta sprzed anonimizacji**". Źródło: `docs/workorders/CLIENT-ANONYMIZATION-RODO.md`.
- Stan faktyczny: model `AuditLog` (`packages/database/prisma/schema.prisma`) **nie ma kolumny `before_snapshot`**, a `customers-anonymize-rodo.test.ts:654` aktywnie zamraża jej nieobecność, asertując, że ciało modelu nie zawiera żadnej z nazw `imie_i_nazwisko`, `telefon`, `ulica_miasto`, `latitude`, `longitude`.
- Pierwsze wymaganie zakłada rejestr z migawką „przed"; drugie zakazuje jakiegokolwiek przechowywania stanu „przed". Kompromis „migawka już zanonimizowana" jest wewnętrznie pusty — migawka zanonimizowanych danych nie różni się od stanu „po" i nie dokumentuje niczego. Nie wybieram sam.

**WYMAGA DECYZJI: `SEC-RODO-DELETE` AC2 — kto wybiera podstawę prawną.**
Kryterium brzmi „Operacja zapisywana w audit_log z `legal_basis = RODO_ERASURE_REQUEST`" (stała). Zaimplementowana i przetestowana `anonymizeClientAction` przyjmuje `legalBasis` jako parametr z pięcioelementowej listy, a `customers-anonymize-ui.test.ts:284` **zakazuje** ustawiania wartości domyślnej (`legalBasis: undefined` w `defaultValues`, zero wystąpień `legalBases[0]`). W efekcie żądanie RODO może dziś zostać zapisane jako `OTHER` i żaden test tego nie wykryje. Rozstrzygnięcia wymaga, czy `SEC-RODO-DELETE` opisuje węższy przypadek użycia (osobna ścieżka „żądanie RODO" wymuszająca stałą) czy jest po prostu przestarzałym opisem tej samej operacji. Wartość `AUDIT_REQUIREMENTS.legalBases[0]` przypadkiem równa się `RODO_ERASURE_REQUEST`, więc test na `:132` jest zielony przez zbieg okoliczności, nie przez dowód.

**Nieznane bez rangi blokady:**
- `SEC-RODO-DELETE` AC1 mówi o „braku kaskadowego kasowania instalacji i **faktur**". W `schema.prisma` nie ma modelu faktur. Kryterium odwołuje się do encji, która nie istnieje — do wyjaśnienia przy okazji decyzji powyżej.
- `SEC-AUDIT-LOG-APPEND-ONLY` AC6 sam deklaruje, że warstwa bazy jest dziś nieweryfikowalna i wymaganie ma pozostać `TODO` do uruchomienia migracji. Nie unieważnia to Bloku C1/C2: test statyczny nad tekstem migracji i test kontraktowy nad `MATRIX` są wykonalne bez bazy i wykrywają regresję w pliku, który dopiero zostanie uruchomiony.
