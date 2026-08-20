# Field App — Wymagania Architektoniczne

## Status dokumentu

To jest dokument **opisowy** (intencja), nie kontrakt. Nie generuje kodu, nie jest czytany przez `kk-codegen`, nie ma statusów `TODO`/`DONE`. Jego zadaniem jest dać `spec-analyst`owi materiał do Work Orderów, a `contract-steward`owi materiał do wymagań w `contracts/requirements.contract.mjs`, ewentualnego nowego `contracts/field.contract.mjs` (progi geofencingu) i rozszerzeń `contracts/rbac.contract.mjs`/`contracts/notifications.contract.mjs`. Dopóki takie okno kontraktowe się nie otworzy, Field App **nie istnieje jako kod** w tym repozytorium — katalog `apps/field-app` nie został jeszcze utworzony.

Ten dokument zastępuje poprzedni stub (12 linii, opisywał PWA i „offline-first" — nieaktualne od decyzji D1 poniżej).

Źródła: specyfikacja biznesowa klienta (PDF) oraz decyzje człowieka z 2026-08-20 (oznaczone `D1`–`D4`). Tam, gdzie PDF i decyzje nie rozstrzygają czegoś jednoznacznie, dokument mówi to wprost w rozdziale 12 („Otwarte pytania"), zamiast zgadywać.

Kontrakt **już dziś** w czterech miejscach zakłada istnienie Field App, mimo że kodu nie ma — patrz rozdział 9.

---

## 1. Cel i zakres

Field App to trzecia aplikacja systemu KlikKlima, obok panelu B2B (dyspozytor/administrator) i aplikacji klienckiej B2C (Triage). Jest narzędziem terenowym dla dwóch ról z macierzy RBAC (`contracts/rbac.contract.mjs`): **audytor** (Etap 2–3 lejka, `T01`→`T02`) i **monter** (Etap 7–8, `T09`, oraz `T17` dla montażu dwuetapowego z ADR-005).

System end-to-end: pozyskanie leada (B2C Triage) → **audyt i wycena (Field App)** → logistyka i montaż (panel B2B + Field App) → serwis i usterki. Field App jest miejscem pracy dokładnie tych dwóch ról terenowych; panel B2B pozostaje miejscem pracy administratora i dyspozytora.

Zakres wersjonowany — patrz rozdział 13 (D2). Ten dokument opisuje **docelową** architekturę (v1+v2+v3 łącznie), z jawnym oznaczeniem, co należy do której wersji.

---

## 2. Stos technologiczny i umiejscowienie w monorepo (D1)

| Warstwa | Decyzja | Odrzucone |
|---|---|---|
| Platforma | React Native + Expo | PWA, wariant hybrydowy |
| Umiejscowienie | `apps/field-app` (nowy pakiet w Turborepo, jeszcze nieutworzony) | osobne repozytorium |

**Powód:** przecięcie promienia 3 km (workflow 3, rozdział 6) wymaga geolokalizacji działającej w tle aplikacji. PWA na iOS nie udostępnia background geolocation w sposób wystarczający dla tego wymagania — stąd odrzucenie PWA mimo że reszta systemu (B2C) świadomie wybrała web (ADR-001).

**Konsekwencja dla ADR-001.** ADR-001 rozstrzyga stos dla panelu B2B (Next.js + Server Actions + Prisma) i B2C (Next.js + `supabase-js` + RLS), ale **nie obejmuje aplikacji mobilnej** — Server Actions nie istnieją w React Native. Sposób, w jaki Field App wykonuje mutacje (bezpośrednio `supabase-js` z urządzenia pod RLS, analogicznie do B2C, czy przez dedykowaną warstwę API/Edge Functions), nie jest rozstrzygnięty przez żadną istniejącą decyzję i jest otwartym pytaniem — patrz rozdział 12.

---

## 3. Komponenty systemu

Wiernie ze specyfikacji biznesowej:

| Komponent | Funkcjonalności | Użytkownik |
|---|---|---|
| **Field App** (mobilna) | Odbiór zleceń, nawigacja, moduł geofencingu, obsługa aparatu do dokumentacji zdjęciowej, zarządzanie certyfikatami i profilem | Audytorzy, Ekipy Monterskie |
| **Panel Administracyjny** (web, istniejący panel B2B) | Zakładanie kont, zarządzanie uprawnieniami, przypisywanie leadów, weryfikacja zdjęć z montażu, kontrola statusów umów | Administrator |
| **Moduł Komunikacyjny** | Automatyczna wysyłka e-mail/SMS (zdjęcie pracownika, linki do płatności, faktury, protokoły), śledzenie geolokalizacji | Klient końcowy |

„Panel Administracyjny" tu opisany **nie jest nową aplikacją** — to rozszerzenie istniejącego panelu B2B (`apps/b2b-web`) o dwie nowe zdolności: **weryfikację zdjęć z montażu** (nowa, patrz rozdział 5.4 i otwarte pytanie w rozdziale 12) oraz **kontrolę statusów umów** (częściowo istniejąca poprzez `LeadStatus`, rozszerzona o `quotes.approval_status`/`payment_status` z planowanego modelu). Zakładanie kont, uprawnienia i przypisywanie leadów już istnieją w panelu B2B (Epic 3 i 5 z `b2b_app_requirements.md`, macierz RBAC).

„Moduł Komunikacyjny" to istniejąca kolejka powiadomień (`notification_queue`, `contracts/notifications.contract.mjs`) — rozdział 9 mapuje wymagania z PDF na jej istniejący katalog.

---

## 4. Role i konta

### 4.1 Konto pracownika Field App (audytor / monter)

Zgodnie z PDF, każde konto ma trzy obowiązkowe elementy:

- **Zarządzanie wizytówką**: edycja danych kontaktowych, krótki opis (bio), wyraźne zdjęcie profilowe. To zdjęcie **nie jest tylko awatarem wewnętrznym** — trafia do klienta w powiadomieniu N1 (rozdział 9), żeby klient wiedział, kogo wpuścić do domu. `auditors.photo_url` i `crews.photo_url` już istnieją w planowanym modelu (`database_model.md`), obsługiwane przez `signStoragePaths` (`apps/b2b-web/src/lib/storage/signed-urls.ts`) na buckety `audytorzy` i `zespoly`. Field App musi pisać do tych samych bucketów, nie tworzyć równoległych.
- **Autoryzacja techniczna**: obligatoryjne wgranie certyfikatów i uprawnień (np. F-Gaz) wraz z datami ważności. Schemat dziś zna wyłącznie **numer i datę ważności** certyfikatu (`fgaz_certificate_no`, `fgaz_valid_until`, `sep_qualified`, `sep_valid_until` — `audytorzy` w `schema.prisma`, analogicznie u przedstawiciela zespołu wg ADR-009), **nie sam wgrany plik/skan certyfikatu**. Nie istnieje ani kolumna, ani wpis w słowniku `documents.kind` (`QUOTE_PDF CONTRACT HANDOVER_PROTOCOL PHOTO OTHER` — brak `CERTIFICATE`) na przechowanie samego dokumentu. To jest luka do zamknięcia przy projektowaniu kontraktu — patrz rozdział 12.
- **Zgody RODO i regulamin** (D4): pracownik musi je zaakceptować **przed** podjęciem pierwszego zlecenia. Wzorem `B2C-CONSENT-RODO` (zapis momentu i **wersji** zaakceptowanego dokumentu, nie tylko flagi logicznej) potrzebne jest analogiczne rozwiązanie po stronie pracowniczej. D4 wprost wymaga: **musi istnieć miejsce, w którym administrator wgrywa i wersjonuje treść tych dokumentów** — dziś takiego miejsca nie ma nigdzie w systemie (B2C też nie ma edytora treści regulaminu, tylko statyczne strony — `B2C-CONTENT-PAGES`). To jest nowa zdolność panelu administracyjnego, nie rozszerzenie istniejącej.

### 4.2 `is_active` (blokada administracyjna) vs status dostępności (deklaracja pracownika) — rozdzielić, nie łączyć

To są **dwa różne pojęcia** o różnych właścicielach. Mylenie ich jest podatnością bezpieczeństwa, nie uproszczeniem.

| | `is_active` | Status dostępności (D3) |
|---|---|---|
| **Kto ustawia** | Administrator, z panelu B2B | Sam pracownik, z Field App |
| **Co oznacza** | Blokada konta — brak dostępu do logowania | „Jestem teraz niedostępny" — operacyjna informacja o zdolności przyjmowania zleceń |
| **Gdzie żyje dziś** | `audytorzy.is_active` (`schema.prisma:346`), `Boolean @default(true)` | Nigdzie — nowe pojęcie z D3 |
| **Kto to sprawdza** | `apps/b2b-web/src/utils/supabase/middleware.ts` — blokuje logowanie do **panelu B2B** dla roli `audytor` z `is_active = false`, fail-closed przy błędzie zapytania | Logika auto-przypisania (`CRM-REGION-AUTO`) i widoczność w kalendarzu klienta (rozdział 8) |
| **Wymaganie** | `CRM-AUDYT-AC1` (status `DONE`), AC1.5: „Zablokowane konto nie loguje się do Field App" | Brak dzisiaj — do zdefiniowania przy kontraktowaniu D3 |
| **Odwracalność** | Tak, ale wyłącznie przez administratora | Tak, przez samego pracownika w dowolnej chwili |

**Dlaczego to nie może być jedno pole:** gdyby dostępność operacyjna i blokada administracyjna dzieliły kolumnę, pracownik zablokowany przez administratora (np. po naruszeniu, w trakcie wyjaśniania sprawy) mógłby sam „odblokować się", ustawiając się jako dostępny. To jest dokładnie odwrotność tego, co `is_active` ma gwarantować.

**Ważne zastrzeżenie o stanie dzisiejszym.** Komentarz w `middleware.ts:76-79` mówi wprost: *„Field App poza zakresem repo (R1) — bramka jest ta sama, co dziś sprawdza samą obecność w `AuthorizedUser`"*. Innymi słowy: `CRM-AUDYT-AC1`/AC1.5 jest oznaczone `DONE`, ale to dotyczy **panelu B2B**. Bramka logowania do samego Field App **nie istnieje**, bo Field App nie istnieje. Kiedy Field App powstanie, jego warstwa autoryzacji musi powtórzyć dokładnie ten sam wzorzec: sprawdzenie ograniczone do roli `audytor` (żeby cudzy, niepowiązany rekord `audytorzy.is_active = false` nie blokował fałszywie administratora czy dyspozytora — błąd, który już raz się zdarzył i został naprawiony 2026-08-20), fail-closed przy błędzie zapytania. Analogiczny mechanizm dla roli `monter` musi sprawdzać `crews.is_active`, którego dziś **nic w kodzie nie odczytuje** dla celów autoryzacji (istnieje w planowanym modelu, ale bez konsumenta).

Status dostępności (D3): pracownik może w dowolnej chwili ustawić się jako niedostępny; jego wcześniej wprowadzona dostępność (rozdział 8) jest wtedy **zapamiętywana** i reaktywuje się automatycznie przy powrocie do statusu dostępnego — nie trzeba jej wprowadzać ponownie.

### 4.3 Panel Administracyjny

Zakładanie kont i uprawnień oraz przypisywanie leadów **już istnieją** w panelu B2B (macierz RBAC w `contracts/rbac.contract.mjs`, przejścia `T01`/`T05` w maszynie stanów lejka). Field App nie duplikuje tej funkcjonalności — konsumuje jej efekty (push `I5` przy `T01`, patrz rozdział 9).

Weryfikacja zdjęć z montażu i kontrola statusów umów to rozszerzenia opisane w rozdziałach 5.4, 7 i 12.

---

## 5. Cztery przepływy pracy (workflow)

Poniższe workflow z PDF są mapowane na istniejącą maszynę stanów lejka (`docs/architecture/generated/CONTRACTS.md`) tam, gdzie to możliwe. Rozbieżności między krokami z PDF a dzisiejszym kontraktem są oznaczone wprost.

### 5.1 Audyt i ofertowanie (E1→E3, `T01`→`T02`)

1. Administrator przypisuje lead do audytora (`T01`, istniejące, `FNL-E1-E2`) → audytor dostaje push (`I5`, już w katalogu — rozdział 9).
2. Audytor dojeżdża (geofencing, rozdział 6), zbiera dane na miejscu.
3. Audytor generuje ofertę w **trzech wariantach** (budżetowy, konserwatywny, premium) — to jest funkcja **kalkulatora wycen** (rozdział 11), zakres **v2** (D2).
4. Klient dostaje e-mailem ofertę, fakturę zaliczkową i link do rezerwacji terminu.

**Rozbieżność ze stanem dzisiejszym:** `T02 sendQuote` w kontrakcie i notyfikacja `N4` (`funnel.quote_ready`) już istnieją, ale ich dzisiejszy kształt zakłada **jedną** cenę (`total_price` jako pojedynczą zmienną szablonu), nie trzy warianty. Rozszerzenie na wariant trójwyborowy jest zmianą kontraktu zaplanowaną na v2, nie dostępną dziś.

### 5.2 Akceptacja i planowanie (E3→E4, `T03`)

Klient wybiera wariant, opłaca pierwszą ratę, wybiera datę z kalendarza (rozdział 8) → `T03 acceptQuoteAndBook`, istniejące, `FNL-E3-E4`. Administrator przypisuje ekipę monterską (`T05`, `FNL-E4-E5`), która zyskuje **pełen dostęp do danych z audytu** — to jest wymaganie dostępu do danych (widoczność, nie tylko powiadomienie), już częściowo zaadresowane przez push „Nowe zlecenie instalacji" (rozdział 9), ale z otwartym pytaniem o zakres danych widocznych ekipie przed wyjazdem (kalkulator, zdjęcia audytora — v2/v3).

Płatność pierwszej raty należy do zakresu **v3** (D2) — akceptacja wyceny i rezerwacja terminu bez bramki płatności to v1.

### 5.3 Realizacja (E7, `T09`/`T17`)

1. W dniu montażu klient dostaje przypomnienie ze zdjęciem montera (rozszerzenie `N6`, rozdział 9).
2. Ekipa bliżej niż 3 km → klient dostaje SMS (`N7 crew_en_route`, **już istnieje** w katalogu, `STABLE`).
3. Ekipa wchodzi w strefę 20 m → odblokowanie zlecenia (rozdział 6).
4. Aby zakończyć, monterzy muszą wgrać **cztery** wymagane zdjęcia: jednostka wewnętrzna, jednostka zewnętrzna, budynek z oddali, odpływ skroplin (rozdział 7).

Odpowiada `T09 completeInstallation` (`FNL-E7-E8`, guard `allPhasesCompleted`) dla montażu jednoetapowego i `T17 completePhaseOne` (`FNL-2PHASE`) dla montażu dwuetapowego (ADR-005). **PDF nie wspomina o montażu dwuetapowym** — czy komplet czterech zdjęć obowiązuje dla każdego etapu osobno, czy tylko dla etapu zamykającego (etap II), jest otwartym pytaniem (rozdział 12).

### 5.4 Zakończenie i rozliczenie (E7→E8)

Po **zatwierdzeniu montażu i weryfikacji zdjęć z panelu** system wysyła klientowi protokół zdawczo-odbiorczy, kartę gwarancyjną, dokumentację i fakturę końcową z linkiem do płatności. Zakończenie odblokowuje wypłatę wynagrodzenia dla audytora i ekipy.

**To jest najważniejsza rozbieżność między PDF a dzisiejszym kontraktem.** `T09 completeInstallation` w kontrakcie jest akcją aktora `INSTALLER` — jedna akcja montera zamyka etap i odpala `N8` (`funnel.install_completed`, załączniki `warranty_card`, `handover_protocol`, `invoice` — treściowo dokładnie to, co opisuje PDF). PDF opisuje **dwa oddzielone kroki**: (a) monter wgrywa zdjęcia i zamyka swoją część, (b) administrator **weryfikuje zdjęcia z panelu**, i dopiero to wysyła `N8`. Czy między `T09` a `N8` ma być wstawiona bramka zatwierdzenia administratora, czy zdjęcia są tylko warunkiem wstępnym (guard) bez osobnego kroku decyzyjnego człowieka, nie jest rozstrzygnięte — patrz rozdział 12.

Wypłata wynagrodzenia audytora i ekipy to zakres **v3** (D2, brak płatności/wypłat w v1).

---

## 6. Geofencing i model GPS/RODO (D4)

### 6.1 Blokada geolokalizacyjna

Aplikacja blokuje przyciski „Rozpocznij" i „Zakończ", dopóki GPS nie znajdzie się w promieniu **20 metrów** od punktu docelowego. Efekt: „Odblokowanie operacji" — alert w aplikacji, patrz rozdział 9 (nie jest to komunikacja z żadnym odbiorcą z katalogu powiadomień, to lokalne zdarzenie urządzenia).

### 6.2 Alert 3 km (klient)

Gdy pracownik przecina promień **3 km** od adresu klienta, w oknie czasowym dnia wizyty, klient dostaje SMS. To już istnieje w katalogu powiadomień jako `N3` (`funnel.auditor_en_route`) i `N7` (`funnel.crew_en_route`) — oba `STABLE`, `bind.kind = 'GEO'` (`contracts/notifications.contract.mjs`). Analogiczne powiadomienia istnieją też dla serwisu (`N13`) i usterek (`N17`). Geofencing Field App nie tworzy nowego typu powiadomienia — jest **producentem zdarzenia**, które te już istniejące powiadomienia konsumują.

### 6.3 Twardy blocker: brak współrzędnych w bazie

**Ani 20 m, ani 3 km nie da się dziś zaimplementować.** Tabela `adresy` (`schema.prisma:53-62`) ma wyłącznie pole `ulica_miasto` (wolny tekst) — brak `lat`/`lng`. Planowany model docelowy (`database_model.md`, `addresses`) już zakłada te kolumny, ale migracja nie została wykonana.

Co gorsza, dane geograficzne **już są zbierane i już są tracone**:

- `apps/b2c-web/components/triage/steps/Step8Booking.tsx:188-189` geokoduje adres przez Google Places i wysyła `lat`/`lng` w obiekcie przekazywanym do `saveLead()`.
- `apps/b2c-web/app/actions/saveLead.ts` — interfejs `SaveLeadData` (linie 6-14) **nie deklaruje** pól `lat`/`lng`. TypeScript to przepuszcza, bo `leadData` w Step8Booking nie jest literałem obiektowym adnotowanym tym typem (structural typing bez sprawdzania nadmiarowych właściwości). Insert do `adresy` (linie 32-39) zapisuje wyłącznie `klient_id` i `ulica_miasto` — `lat`/`lng` są odrzucane po drodze, dla **każdego** leada.
- Dla kontrastu: druga, równoległa ścieżka tworzenia leada, `apps/b2c-web/app/actions/leads.ts` (`submitFinalTriage`), **zapisuje** `lat`/`lng` do `adresy` (linie 79-80) — ale zapisuje też lead w kształcie niezgodnym z `LeadStatus` (`status_triage: "Wykonany"` zamiast stanu z maszyny stanów) i nie jest ścieżką aktualnie podłączoną pod UI Triage. Ten sam duplikat ścieżek jest już odnotowany jako problem w wymaganiu `B2C-LEAD-ENTRY`.

Konsekwencja: zamknięcie tej luki nie jest wyłącznie zadaniem Field App — wymaga (a) migracji `lat`/`lng` do `adresy`/`addresses`, (b) naprawy `SaveLeadData` i ścieżki zapisu w B2C tak, żeby współrzędne faktycznie trafiały do bazy, zanim geofencing Field App będzie miał z czego czytać.

### 6.4 Model zbierania GPS (RODO)

D4 ustala twarde ograniczenia:

- GPS zbierany **wyłącznie** w oknie czasowym aktywnego, przypisanego zlecenia — nigdy poza nim.
- Zapis jako **zdarzenia punktowe**: odblokowanie 20 m, przecięcie 3 km, zamknięcie — **nie** ciągły ślad trasy (brak tabeli logującej pozycję co N sekund).
- To odpowiada komentarzowi w `contracts/notifications.contract.mjs`: `bind.kind: 'GEO' — Field App: „Wyruszam" / wejście w promień` — kontrakt już zakłada zdarzeniowy, nie ciągły, model geolokalizacji.

### 6.5 Progi jako stałe kontraktowe

Zasada zerowa z `CLAUDE.md`, pułapka nr 5 („Wszystkie progi czasowe pochodzą z kontraktu SLA") dotyczy analogicznie progów **przestrzennych**. Dziś `contracts/sla.contract.mjs` nie zawiera żadnej stałej geofencingu — `20` metrów i `3` kilometry z PDF nie mają dziś kontraktowego domu. Rekomendacja dla `contract-steward`: `GEOFENCE_UNLOCK_RADIUS_M = 20` i `GEOFENCE_EN_ROUTE_RADIUS_KM = 3` powinny trafić do kontraktu (SLA albo nowy `field.contract.mjs`) zamiast być literałami w kodzie Field App — inaczej powtarza się dokładnie ten sam problem, który `SLA-QUOTE-14D` już raz rozwiązał dla progu 14 dni.

---

## 7. Dostępność i kalendarz (D3)

To jest **istotne rozszerzenie względem PDF** — decyzja człowieka wykracza poza to, co opisywała specyfikacja biznesowa źródłowa.

- Audytorzy i ekipy monterskie ustawiają w Field App własną dostępność: **godziny w każdym dniu tygodnia**, planowaną w kalendarzu.
- Kalendarz pokazywany klientowi (przy rezerwacji audytu w B2C i rezerwacji montażu) to **suma wszystkich dostępnych terminów** wszystkich audytorów/ekip zgodnie z ich ustawieniami — nie kalendarz jednej osoby.
- **Google Calendar jest domyślnym, obowiązkowym kalendarzem** dla audytorów i ekip. Nie jest to opcja integracyjna — to wymagany element przepływu pracy.
- Ustawienie się jako niedostępny **zapamiętuje** wcześniej wprowadzoną dostępność (rozdział 4.2) i reaktywuje ją automatycznie przy powrocie.

### 7.1 Styk z istniejącym planowanym modelem

Planowany model (`database_model.md`, ADR-012) już zawiera część infrastruktury kalendarzowej, ale **nie w kształcie, który D3 opisuje**:

- `bookings` — jedyne źródło prawdy o **konkretnych rezerwacjach** (planowana tabela, nieistniejąca dziś w `schema.prisma`). To pokrywa zapisany termin, nie deklarację dostępności.
- `absences` — blokady kalendarza: urlop, zwolnienie, awaria auta (`reason: VACATION SICK_LEAVE VEHICLE_FAILURE OTHER`). To są **wyjątki nakładane na** harmonogram, nie sam harmonogram.
- **Brak tabeli na cykliczną, tygodniową dostępność godzinową** („poniedziałki 8-16, wtorki wolne") — ani w schemacie, ani w planowanym modelu ERD. To jest nowa struktura danych, którą D3 wymusza i której dziś nigdzie nie ma.
- `auditors.availability_status` w planowanym ERD to płaski string (`"ACTIVE ON_LEAVE SICK_LEAVE"`) — zdolność zgrubna, jednowymiarowa. `CRM-REGION-AUTO` (wymaganie już w rejestrze, status `TODO`) explicite wymaga, żeby auto-przypisanie audytora respektowało `availability_status` **i** `daily_audit_cap`, mimo że żadne z tych pól nie istnieje jeszcze w `schema.prisma`. Czy ten sam `availability_status` ma być pochodną (agregatem) godzinowej dostępności z D3, czy to dwa niezależne pola o różnym poziomie szczegółowości, jest otwartym pytaniem (rozdział 12) — nie należy zakładać, że to jedno pole tylko dlatego, że nazwy są podobne.

---

## 8. Dokumentacja zdjęciowa

Aby zakończyć montaż (`T09`/`T17`, rozdział 5.3), monterzy muszą wgrać **dokładnie cztery** wymagane zdjęcia:

1. Jednostka wewnętrzna
2. Jednostka zewnętrzna
3. Budynek z oddali
4. Odpływ skroplin

### 8.1 Stan dzisiejszy — brak miejsca na te dane

Model `instalacje` w `schema.prisma:205-220` ma pole `protokol_url` (pojedynczy string, jeden plik) i **nic więcej** związanego z dokumentacją zdjęciową — brak kolumny na wiele zdjęć, brak `jsonb`. Planowany model (`database_model.md`) przewiduje `installation_photos jsonb` na `installations` oraz osobną tabelę `documents` z `kind = PHOTO`, ale żadne z nich nie istnieje w dzisiejszym schemacie.

### 8.2 Storage

Istnieją już buckety Supabase Storage `audytorzy` i `zespoly` — służą wyłącznie awatarom, obsługiwane przez `signStoragePaths` (`apps/b2b-web/src/lib/storage/signed-urls.ts`, generowanie podpisanych URL bez N+1, odporne na częściową awaria storage). Dokumentacja montażowa **potrzebuje własnego bucketu i własnych polityk RLS** — inny rozmiar plików, inny cykl życia (dowód wykonania usługi, potencjalnie potrzebny przy reklamacji — `CRM-UST-AC2` już wymaga załączania zdjęć/wideo do usterek w podobnym duchu), inni odbiorcy (administrator weryfikujący, rozdział 5.4).

---

## 9. Powiadomienia — mapowanie na istniejący katalog

Katalog powiadomień (`contracts/notifications.contract.mjs`) **już zna Field App** w czterech miejscach, mimo że kod Field App nie istnieje. To nie jest greenfield dla warstwy powiadomień — to domykanie istniejących zaczepień.

### 9.1 Już istnieje (JEST)

| Z PDF | Istniejący ID | Uwagi |
|---|---|---|
| Nowe zlecenie audytu (push) | **`I5`** | `internal.auditor_task_assigned`, `TRANSITION T01`, `STABLE`. Dokładnie odpowiada opisowi z PDF: „przydzielenie leada audytorowi → powiadomienie na ekranie blokady; po kliknięciu audytor widzi termin, dane klienta, adres." |
| Alert o zbliżającej się wizycie audytora (SMS, 3 km) | **`N3`** | `funnel.auditor_en_route`, `GEO auditor_en_route`, `STABLE`. |
| Alert o zbliżającej się wizycie ekipy (SMS, 3 km) | **`N7`** | `funnel.crew_en_route`, `GEO crew_en_route`, `STABLE`. |
| Podsumowanie i rozliczenie końcowe (e-mail) | **`N8`** | `funnel.install_completed`, załączniki `warranty_card`, `handover_protocol`, `invoice` — treściowo pokrywa protokół zdawczo-odbiorczy, kartę gwarancyjną i fakturę końcową z PDF. Nie zawiera linku do bramki płatności (`link` nie jest dziś w `vars` tego wpisu) — v3 (płatności) będzie musiał go dodać. |

### 9.2 Trzeba dodać lub rozszerzyć (BRAK / CZĘŚCIOWE)

| Z PDF | Stan dzisiejszy | Co trzeba zrobić |
|---|---|---|
| Potwierdzenie przypisania pracownika (e-mail, ze **zdjęciem twarzy** pracownika) | `N1` (`funnel.auditor_assigned`, `TRANSITION T01`) istnieje, ale `vars: ['first_name', 'order_number']` **nie zawiera** zmiennej ze zdjęciem pracownika. | Rozszerzyć `N1` o zmienną (np. `employee_photo_url`) albo — jeśli semantyka „przypisanie audytora" i „przypisanie ekipy" mają się rozjechać treściowo — rozważyć osobny wpis dla przypisania ekipy montażowej (dziś nie ma odpowiednika `N1` dla `T05 assignCrew` skierowanego do klienta, tylko `I3` do samej ekipy). |
| Oferta po audycie w **trzech wariantach** (e-mail) | `N4` (`funnel.quote_ready`) istnieje, `vars: ['first_name', 'link', 'total_price']` — jedna cena. | v2: rozszerzenie o warianty budżetowy/konserwatywny/premium — zależne od kalkulatora (rozdział 11). |
| Nowe zlecenie instalacji (push do ekipy) | Dziś odpowiednikiem `T05 assignCrew` jest **`I3`** — kanał **SMS**, nie PUSH. | Rozbieżność kanału do rozstrzygnięcia przez `notification-architect`: czy `I3` zmienia kanał na PUSH (spójnie z `I5` dla audytora), czy PDF opisuje coś, co ma współistnieć obok `I3`. Nie rozstrzygam tego tutaj — to decyzja właściciela kontraktu powiadomień. |
| Odblokowanie operacji (alert w aplikacji przy wejściu w 20 m) | Brak w katalogu. | To **nie jest** komunikacja z odbiorcą z listy `RECIPIENTS` (`CLIENT DISPATCHER AUDITOR CREW ADMIN`) — to lokalny stan UI urządzenia, nie wiadomość do wysłania przez kolejkę. Prawdopodobnie poza zakresem katalogu powiadomień; do potwierdzenia przy kontraktowaniu. |

---

## 10. Moduł dokumentacji (generowanie PDF)

System pobiera zmienne od audytora i monterów (parametry sprzętu z kalkulatora, dane klienta, zdjęcia, checkboxy) i mapuje je na szablony PDF: oferty, umowy, protokoły zdawczo-odbiorcze — wysyłane jako załączniki.

**Ważna nieoczywistość:** ten moduł nie dzieli się czysto na „v1 bez PDF, v2 z PDF". `T09 completeInstallation` (`FNL-E7-E8`) ma już dziś w kontrakcie efekt **`do:generateHandoverProtocol`** — a zamknięcie montażu E7→E8 jest jawnie w zakresie **v1** (D2). To oznacza, że generowanie **przynajmniej jednego** szablonu PDF (protokół zdawczo-odbiorczy) jest zależnością v1, nawet jeśli oferta trójwariantowa i umowa (zależne od kalkulatora) zostają w v2. Rozdzielenie modułu dokumentacji na „to, co domyka v1" i „to, co przychodzi z kalkulatorem w v2" jest pytaniem otwartym do `contract-steward` (rozdział 12), nie założeniem tego dokumentu.

---

## 11. Kalkulator wycen

Moduł analityczny w aplikacji audytora: wprowadzenie parametrów technicznych zebranych u klienta → wyliczenie zapotrzebowania na moc chłodniczą → dobór jednostek z bazy sprzętowej (`indoor_units`, `outdoor_units`, `single_split_sets`, `multi_split_sets` — te tabele już istnieją i są używane przez kalkulator B2C, `B2C-PRICE-FROM`) → kalkulacja kosztów materiałów i robocizny → automatyczna podstawa pod trójwariantową ofertę.

Zakres **v2** (D2). Baza sprzętowa, którą ten kalkulator będzie odpytywał, już istnieje i jest współdzielona z B2C — nie powstaje od zera, ale logika doboru „na podstawie audytu terenowego" (zamiast deklaracji klienta z Triage) jest nowa.

---

## 12. Otwarte pytania

Rzeczy, których ani PDF, ani decyzje D1-D4 nie rozstrzygają. Nie zgaduję odpowiedzi — to pytania do rozstrzygnięcia przy projektowaniu kontraktu.

1. **Warstwa mutacji Field App.** ADR-001 nie obejmuje aplikacji mobilnej. Czy Field App pisze bezpośrednio przez `supabase-js` pod RLS (analogicznie do B2C), czy przez dedykowaną warstwę API/Edge Functions? (rozdział 2)
2. **Bramka weryfikacji administratora.** Czy między zamknięciem montażu przez montera (`T09`) a wysyłką `N8`/wypłatą wynagrodzenia jest wstawiony osobny krok decyzyjny „administrator zatwierdza zdjęcia z panelu", czy komplet zdjęć jest wyłącznie guardem blokującym `T09` bez dodatkowego kroku człowieka po stronie admina? (rozdział 5.4)
3. **Model integracji z Google Calendar.** Dwukierunkowa synchronizacja (Field App zapisuje, Google Calendar też może modyfikować) czy wyłącznie odczyt zajętości z Google Calendar do wyliczenia widoku klienta? (rozdział 7)
4. **`availability_status` a godzinowa dostępność tygodniowa (D3).** Czy to jedno pole w różnej granulacji, czy dwa niezależne mechanizmy — jeden zgrubny (`CRM-REGION-AUTO`, auto-przypisanie), drugi szczegółowy (kalendarz klienta)? (rozdział 7.1)
5. **Przechowywanie plików certyfikatów.** Czy rozszerzyć słownik `documents.kind` o `CERTIFICATE`, czy potrzebna osobna struktura? Dziś nie istnieje żadne miejsce na sam plik certyfikatu — tylko numer i data ważności. (rozdział 4.1)
6. **Wersjonowanie zgód RODO/regulaminu pracowniczego.** Gdzie dokładnie administrator wgrywa i wersjonuje te dokumenty — nowa tabela, rozszerzenie istniejącego mechanizmu treści statycznych B2C, czy coś trzeciego? (rozdział 4.1)
7. **Komplet zdjęć przy montażu dwuetapowym.** Czy cztery wymagane zdjęcia obowiązują przy zamknięciu każdego etapu (`T17` i `T09`), czy tylko przy etapie zamykającym całość? PDF nie wspomina o ADR-005. (rozdział 5.3)
8. **Kanał powiadomienia „nowe zlecenie instalacji" dla ekipy.** PUSH (zgodnie z PDF) czy pozostaje SMS jak dzisiejsze `I3`? (rozdział 9.2)
9. **Dom kontraktowy progów geofencingu.** `contracts/sla.contract.mjs` czy nowy, dedykowany `contracts/field.contract.mjs`? (rozdział 6.5)
10. **Zakres danych audytu widoczny ekipie „natychmiast po przydzieleniu".** PDF mówi o „natychmiastowym podglądzie pełnego planu audytora (przygotowanie sprzętu przed wyjazdem)" — czy to obejmuje zdjęcia i notatki audytora z wizji lokalnej, czy tylko dane z kalkulatora/wyceny? (rozdział 5.2)

---

## 13. Zakres wersjonowany (D2)

| Wersja | Zakres |
|---|---|
| **v1** | Odbiór zleceń, profil + certyfikaty (bez wgrywania samego pliku certyfikatu — patrz otwarte pytanie 5), geofencing (zależny od zamknięcia blockera ze rozdziału 6.3), dokumentacja zdjęciowa, zamknięcie montażu (E7→E8). Generowanie protokołu zdawczo-odbiorczego (PDF) jest zależnością v1 — patrz rozdział 10. |
| **v2** | Oferta trójwariantowa, kalkulator wycen, pozostała część modułu generowania PDF (oferty, umowy). |
| **v3** | Płatności, faktury, wypłaty wynagrodzenia dla audytora i ekipy. |

**Explicite poza v1:** żadna forma płatności ani wypłaty. Kalendarz i dostępność (D3, rozdział 7) nie są przypisane do konkretnej wersji przez D2 — logicznie należą do v1, bo bez nich nie da się zarezerwować terminu montażu, co jest warunkiem wejścia do E7 (rozdział 5.2). Traktuję to jako domyślne założenie, nie jako jawnie potwierdzoną decyzję — do potwierdzenia przy planowaniu Work Orderów.

---

## 14. Zależności — podsumowanie blokerów

Zebrane z powyższych rozdziałów, dla `spec-analyst`a planującego kolejność Work Orderów:

1. **Blocker geofencingu (rozdział 6.3):** brak `lat`/`lng` w `adresy`/`addresses` + utrata już zbieranych współrzędnych w `saveLead.ts`. Musi być zamknięty przed jakąkolwiek pracą nad blokadą 20 m/3 km.
2. **Brak miejsca na zdjęcia montażowe (rozdział 8.1):** `instalacje` ma tylko `protokol_url`. Musi być zamknięty przed workflow 3 (rozdział 5.3).
3. **`quotes`, `bookings`, `absences`, `notification_queue`, `audit_log`, integracje SMS/e-mail/push, generowanie PDF, płatności — żadne z tych nie istnieje** w dzisiejszym `schema.prisma`. Wszystkie są w planowanym modelu (`database_model.md`, ADR-012), ale niezmigrowane. Field App v1 zależy co najmniej od `bookings` (rezerwacja terminu montażu) i mechanizmu powiadomień push (`device_tokens`, `I5` już `STABLE` w katalogu, ale bez nośnika w bazie nie da się go dziś dostarczyć).
4. **Duplikat ścieżek tworzenia leada w B2C** (`saveLead.ts` vs `leads.ts`, już odnotowany w `B2C-LEAD-ENTRY`) bezpośrednio wpływa na blocker geofencingu — obie ścieżki traktują `lat`/`lng` inaczej, więc naprawa musi objąć obie albo jawnie zlikwidować jedną.
