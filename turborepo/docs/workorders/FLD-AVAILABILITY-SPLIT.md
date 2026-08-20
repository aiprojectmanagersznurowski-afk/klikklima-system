# WO: FLD-AVAILABILITY-SPLIT — rozdzielenie blokady administracyjnej od deklaracji dostępności pracownika

> **STATUS: WYMAGA DECYZJI D-A. Nie startować.**
> Kształt schematu zależy od odpowiedzi na pytanie o właściciela statusu dostępności. Migracja jest
> nieodwracalna w praktyce (dane produkcyjne), a zła odpowiedź daje pracownikowi możliwość zdjęcia
> sobie blokady nałożonej przez administratora. To jest podatność, nie niedogodność.

**Cel:** `is_active` ma pozostać wyłączną własnością administratora, a „jestem teraz niedostępny"
ma być własnością pracownika — i te dwie rzeczy nie mogą dzielić kolumny ani ścieżki zapisu.
Przy okazji domknąć wymaganie `CRM-REGION-AUTO`, które już dziś odwołuje się do pola, którego nie ma.

**Rola wiodąca:** `contract-steward`. **Okno kontraktowe: WYMAGANE**
(`contracts/requirements.contract.mjs`, `contracts/rbac.contract.mjs`, `schema.prisma`, `supabase/migrations/`).

## Wymagania

| ID | Stan | Uwaga |
|---|---|---|
| `CRM-REGION-AUTO` | `TODO`, MEDIUM, 0 testów | kryterium „Auto-przypisanie respektuje `daily_audit_cap` i `availability_status`" wskazuje **dwa pola, których nie ma w `schema.prisma`** |
| `CRM-AUDYT-AC1` | `DONE` (zwężone w WO-A) | kryterium o puli przypisania i odwracalności blokady nie może zostać osłabione tą zmianą |
| `FLD-AVAIL-SELF` | **nowe, w tym WO** | pracownik deklaruje niedostępność |
| `FLD-AVAIL-RESTORE` | **nowe, w tym WO** | powrót przywraca wcześniejszą dostępność (D3) |

Wymagania `FLD-AVAIL-*` powstają dopiero tutaj, a nie w WO-A, bo ich kryteria akceptacji są wprost
pochodną decyzji D-A. Zapisane wcześniej trzeba by przepisać.

## Kontekst kodu (zweryfikowany 2026-08-20/21)

### Istnieje

| Miejsce | Stan faktyczny |
|---|---|
| `schema.prisma:353` | `audytorzy.is_active Boolean @default(true)` — dodane 2026-08-20, komentarz mówi wprost: „blokada konta audytora, `false` = brak dostępu do Field App i brak w puli wyboru" |
| `schema.prisma:182` | `zespoly_monterskie.aktywny Boolean @default(true)` — **inna nazwa dla tego samego pojęcia**. Dług nazewniczy zamrożony (`KK-NAMING-BASELINE`), więc to nie jest do naprawy w tym WO, ale jest do świadomego uwzględnienia |
| `apps/b2b-web/.../leads/actions.ts:78-104` | `getAuditors()` → `where: { is_active: true }`. `getCrews(installationDate)` → `where: { aktywny: true }` + filtr ważności certyfikatów. To jest **jedyne dziś działające miejsce**, w którym „dostępność" wpływa na cokolwiek |
| `apps/b2b-web/src/utils/supabase/middleware.ts` | bramka logowania czyta `audytorzy.is_active`, zawężona do roli `audytor`, fail-closed. Nic nie czyta `zespoly_monterskie.aktywny` w celach autoryzacji |
| `contracts/rbac.contract.mjs` | `auditors: { update: ['admin'] }`, `crews: { update: ['admin'] }`. **Pracownik nie ma dziś prawa zapisu do własnego rekordu — żadnego** |
| `docs/architecture/b2b_crm_specifications.md:136` | „**Status dostępności:** Aktywny / Urlop / Zwolnienie" — w rozdziale opisującym widok **administratora/dyspozytora** |
| `docs/architecture/database_model.md:52,624` | `auditors.availability_status "ACTIVE ON_LEAVE SICK_LEAVE"`, komentarz: „Aktywny / Urlop / Zwolnienie (CRM §5)" |
| `docs/DECISIONS.md` (D3) | „Audytorzy i ekipy ustawiają **w Field App** własną dostępność (…) Ustawienie się jako niedostępny zapamiętuje wcześniejszą dostępność i reaktywuje ją przy powrocie" |

### Brakuje

1. Jakiegokolwiek pola dostępności — w `audytorzy` i w `zespoly_monterskie`.
2. `daily_audit_cap` (drugie pole, którego żąda `CRM-REGION-AUTO`; dziś jest tylko globalny
   `SLA.AUDITOR_DAILY_CAP = 5`). **Świadomie poza zakresem tego WO** — patrz „Poza zakresem".
3. Ścieżki zapisu dla pracownika. RBAC nie daje mu `update` na żadnym zasobie związanym z jego rekordem.
4. Tabeli `absences` (planowana, ADR-012, faza 4) — czyli miejsca, w którym „Urlop / Zwolnienie" ma
   docelowo mieszkać jako datowany wyjątek, a nie jako flaga na rekordzie pracownika.

## Zmiana kontraktu

**WYMAGANA**, w dwóch plikach naraz i to jest sedno problemu:

- `schema.prisma` + migracja — nowe pole (lub pola) dostępności na `audytorzy` i `zespoly_monterskie`.
- `contracts/rbac.contract.mjs` — bez zmiany w macierzy pracownik nie ma jak zapisać własnej
  dostępności. **A każda zmiana, która daje mu `update` na `auditors`, daje mu równocześnie `is_active`.**

## Decyzje wymagające człowieka

### D-A — kto jest właścicielem statusu dostępności i gdzie ten status mieszka

Sprzeczność między dokumentami, cytaty:

> `docs/architecture/b2b_crm_specifications.md:136` (§5, „Widok: Audytorzy", sekcja *Model danych*):
> „**Status dostępności:** Aktywny / Urlop / Zwolnienie."

> `docs/architecture/database_model.md:624` (§ zmiany w tabelach):
> „`auditors` | + `availability_status` | Aktywny / Urlop / Zwolnienie (CRM §5)"

> `docs/DECISIONS.md`, D3 (2026-08-20):
> „Audytorzy i ekipy monterskie ustawiają **w Field App** własną dostępność godzinową per dzień
> tygodnia. (…) Ustawienie się jako niedostępny zapamiętuje wcześniejszą dostępność."

> `docs/architecture/field_app_requirements.md#12`, pytanie otwarte 4:
> „Czy to jedno pole w różnej granulacji, czy dwa niezależne mechanizmy — jeden zgrubny
> (`CRM-REGION-AUTO`, auto-przypisanie), drugi szczegółowy (kalendarz klienta)?"

Pierwsze dwa opisują pole **administratora** o wartościach kadrowych (urlop, zwolnienie). Trzecie
opisuje deklarację **pracownika**. Nazwa jest podobna, właściciel inny. Do tego dochodzi trzeci
mechanizm na te same fakty: planowana tabela `absences` (`VACATION`, `SICK_LEAVE`, `VEHICLE_FAILURE`,
`OTHER`, RBAC: `create: ['admin', 'dyspozytor']`).

Warianty:

- **A1 — dwa pola.** `availability_status` (administrator, `ACTIVE`/`ON_LEAVE`/`SICK_LEAVE`, zgodnie
  z CRM §5) plus osobne pole pracownika (`is_available`/`self_availability`). Auto-przypisanie wymaga
  obu „zielonych". Koszt: trzy flagi na rekordzie pracownika (`is_active`, status kadrowy, deklaracja),
  a to znaczy trzy powody, dla których ktoś „nie widzi się na liście", i trzy miejsca do sprawdzenia
  przy zgłoszeniu.
- **A2 — jedno pole, jeden właściciel: pracownik.** `availability_status` staje się deklaracją
  pracownika, a urlop/zwolnienie przechodzą do `absences` (faza 4). Koszt: do czasu powstania
  `absences` nie ma gdzie zapisać urlopu; `CRM-REGION-AUTO` musi wtedy respektować dwa źródła.
- **A3 — osobny zasób.** Dostępność w oddzielnej tabeli (np. `worker_availability`) z własnym wierszem
  w macierzy RBAC. **To jedyny wariant, w którym pracownik dostaje `update` na czymś, co nie zawiera
  `is_active`.** Koszt: nowa encja, nowy zasób w `RESOURCES` i `MATRIX` (R13 wymaga wiersza dla każdego
  zasobu, `delete` wyłącznie dla `admin`).

**Ostrzeżenie, które ma znaczenie niezależnie od wybranego wariantu:** w A1 i A2 pole dostępności leży
na rekordzie `audytorzy`/`zespoly_monterskie`. Żeby pracownik mógł je zmienić, `contracts/rbac.contract.mjs`
musi dostać `auditors.update: ['admin', 'audytor:own']` — a ta pozycja w macierzy nie rozróżnia kolumn.
Od tej chwili jedynym, co dzieli pracownika od skasowania własnej blokady administracyjnej, jest
dyscyplina w kodzie Server Action i polityka RLS na poziomie kolumny. Dokładnie ten rodzaj obrony
zawiódł już raz w tym repozytorium (Server Actions bez sprawdzenia roli, Prisma omija RLS).

Nie wybieram za człowieka. **WYMAGA DECYZJI: który z wariantów A1 / A2 / A3, i czy dopuszczamy
`audytor:own`/`monter:own` w `update` na encji zawierającej `is_active`.**

## Kryteria akceptacji (do domknięcia po decyzji D-A)

Poniższe obowiązują w każdym wariancie; sformułowania w nawiasach uzupełnia decyzja.

- [ ] **AC1** Pracownik ustawiający się jako niedostępny **nie zmienia** wartości `is_active`
      (`audytorzy`) ani `aktywny` (`zespoly_monterskie`) — test odczytuje obie wartości przed i po.
- [ ] **AC2** Pracownik zablokowany administracyjnie, który ustawia się jako dostępny, **nadal nie
      przechodzi bramki logowania i nadal nie występuje w puli przypisania**. To jest ten scenariusz,
      dla którego pola się rozdziela — musi mieć własny, jawny test.
- [ ] **AC3** Próba zapisu `is_active`/`aktywny` przez konto o roli `audytor`/`monter` jest odrzucona
      **po stronie serwera**, a nie tylko niedostępna w interfejsie.
- [ ] **AC4** Pracownik niedostępny (przy aktywnym koncie) nie występuje w puli wyboru przy
      przypisaniu — dokładnie tam, gdzie dziś działa filtr `is_active`/`aktywny` w `getAuditors()`
      i `getCrews()`, bez tworzenia drugiego, równoległego filtra.
- [ ] **AC5** Powrót do statusu dostępnego przywraca wcześniejszą deklarację dostępności bez
      ponownego jej wprowadzania (D3) — test ustawia dostępność, przełącza na niedostępny, wraca
      i sprawdza, że odczytana dostępność jest identyczna z wprowadzoną.
- [ ] **AC6** Wartości statusu pochodzą z zamkniętego słownika (enum w bazie), nie z wolnego tekstu —
      próba zapisu wartości spoza słownika jest odrzucona przez bazę, nie tylko przez walidację aplikacyjną.
- [ ] **AC7** Migracja jest addytywna i idempotentna; istniejące rekordy dostają wartość domyślną
      oznaczającą „dostępny", więc **żaden pracownik nie znika z puli w chwili wdrożenia**.
- [ ] **AC8** Po zmianie kryterium `CRM-REGION-AUTO` („respektuje `daily_audit_cap` i
      `availability_status`") wskazuje pole, które **faktycznie istnieje w `schema.prisma`** — albo
      zostaje przeredagowane tak, by wskazywało pola istniejące. Wymaganie nie może dalej odwoływać
      się do fikcji.
- [ ] **AC9** `node tools/kk-validate.mjs`, `node tools/kk-selftest.mjs` i `node tools/kk-codegen.mjs --check`
      zielone; jeżeli zmienia się macierz RBAC, `R13-rbac` przechodzi (każdy zasób ma wiersz,
      `delete` wyłącznie `admin`).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Odblokowanie się przez pracownika (AC2)** — jedyny powód istnienia tego WO.
- **Wyścig blokady z deklaracją.** Administrator blokuje konto w tej samej chwili, w której pracownik
  ustawia się jako dostępny. Wynik musi być deterministyczny: konto zablokowane, niezależnie od
  kolejności zapisów. Sprawdzenie w JS nie wystarcza — potrzebne ograniczenie albo blokada w bazie.
- **Ekipa, nie tylko audytor.** `zespoly_monterskie.aktywny` **nie jest dziś czytany przez żadną
  bramkę autoryzacyjną**. Test musi objąć obie encje, inaczej rozdzielenie działa dla połowy ról.
- **Wdrożenie na istniejących danych (AC7).** Migracja bez wartości domyślnej wygasza całą pulę
  przypisania w chwili wdrożenia — awaria operacyjna, nie kosmetyczna.
- **Strefa czasowa przy „niedostępny od teraz".** Jeżeli deklaracja niesie moment (`_at`), to
  `timestamptz`, a granica doby liczona w strefie lokalnej pracownika. Repozytorium ma już precedens
  tego błędu: `isCertValidForDate` porównuje po dacie kalendarzowej, nie po pełnym znaczniku czasu.

## Poza zakresem

- **Godzinowa dostępność tygodniowa z D3** („poniedziałki 8-16") i tabela pod nią. To faza 4
  (silnik `availability_rules`/`bookings`/`absences` + Google Calendar). Tutaj powstaje wyłącznie
  status zgrubny — ten, którego żąda `CRM-REGION-AUTO`.
- `daily_audit_cap` per audytor. Wymaganie `CRM-AUDYT-AC2` i próg `SLA.AUDITOR_DAILY_CAP` istnieją;
  nadpisanie per osoba to osobna zmiana schematu i osobne testy.
- Tabela `absences` (ADR-012, faza 1/4).
- Interfejs użytkownika po którejkolwiek stronie — Field App nie istnieje, a widok administratora
  w panelu B2B to osobny WO dla `implementer-ui`.
- Ujednolicenie `aktywny` → `is_active` w `zespoly_monterskie` (`KK-NAMING-BASELINE`, zamrożone).

## Ryzyka i nieznane

- **R1 — trzy mechanizmy na jeden fakt.** `is_active`, status dostępności i przyszłe `absences` mogą
  opisywać to samo („tego człowieka dziś nie ma"). Bez decyzji o rozłączności skończy się to
  pytaniem „dlaczego on się nie wyświetla" z trzema miejscami do sprawdzenia.
- **R2 — RBAC nie zna kolumn.** `contracts/rbac.contract.mjs` operuje na zasobach, nie na polach.
  Wariant A1/A2 wymaga zabezpieczenia na poziomie kolumny (RLS + Server Action), którego macierz nie
  wyrazi, a `rls-security-auditor` nie ma jak sprawdzić przez sam kontrakt.
- **R3 — brak konsumenta po stronie ekip.** Nawet po tym WO nic nie czyta `zespoly_monterskie.aktywny`
  przy autoryzacji; bramka istnieje wyłącznie dla audytorów. Rozdzielenie pojęć nie naprawia tego braku
  i nie należy tego mylić z gotowością.

---

## D-A — ROZSTRZYGNIĘTE (człowiek, 2026-08-21)

**Właściciel statusu dostępności: OBA, ale w rozdzielnych polach.** Dokumenty nie były sprzeczne —
opisywały dwa różne pojęcia jednym słowem:

- **Pracownik** ustawia własną dostępność (samoobsługa z D3: „dziś nie pracuję", z zapamiętaniem
  wcześniej wprowadzonych reguł tygodniowych i ich reaktywacją przy powrocie).
- **Administrator** niezależnie ustawia urlop/zwolnienie (`b2b_crm_specifications.md:136`,
  `database_model.md:624`).

Pracownik **nie może** zdjąć sobie urlopu wpisanego przez administratora, tak samo jak nie może zdjąć
`is_active`. Trzy pojęcia, trzy pola, trzej właściciele — `is_active` (admin, bezpieczeństwo, blokuje
logowanie), status urlopowy (admin, kadrowy), dostępność (pracownik, operacyjny).

**Rozstrzygnięcie R2 (RBAC nie zna kolumn): osobny zasób RBAC na dostępność.** Nowy zasób w
`contracts/rbac.contract.mjs` z `update` dopuszczającym `admin` oraz warianty `:own` dla ról terenowych,
podczas gdy `auditors.update` zostaje `['admin']`. Uprawnienie do edycji własnej dostępności nie niesie
ze sobą uprawnienia do edycji `is_active` — reguła jest wyrażona w macierzy, nie tylko w kodzie akcji,
więc `rls-security-auditor` ma co sprawdzać.
