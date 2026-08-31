# WO: CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN — modale „Dodaj Audytora"/„Dodaj Zespół" + przypisywanie ekipy do leada

## Wymagania: brak zarejestrowanych ID — WYMAGA REJESTRACJI PRZED STARTEM

Żadne z dwóch zadań nie ma dziś wpisu w `contracts/requirements.contract.mjs`.
Najbliższe istniejące wpisy dotyczą czego innego i **nie pokrywają** tej pracy:

- `CRM-AUDYT-AC1` (`status: DONE`) — blokada i usunięcie konta audytora. Nie mówi o tworzeniu.
- `CRM-ZESP-AC2` (`status: DONE`) — ukrywanie ekipy z nieważnym certyfikatem **w puli E4**. Nie mówi o przypisywaniu poza E4.
- `SEC-ASSIGNMENT-POOL-MINIMIZE` (`status: TODO`) — minimalizacja kolumn w `getAuditors()`/`getCrews()` z `leads/actions.ts`. **Każdy nowy konsument tych pul dziedziczy to ograniczenie** (jego AC mówi to wprost: „zestaw pól jest ZAMKNIĘTY także dla przyszłych konsumentów").

Proponowane ID do rejestracji przez `contract-steward` (nazwy do zatwierdzenia przez człowieka):
- `CRM-AUDYT-CREATE` — tworzenie audytora z panelu.
- `CRM-ZESP-CREATE` — tworzenie zespołu z panelu.
- `CRM-LEAD-CREW-ASSIGN` — przypisywanie/zmiana ekipy przy leadzie poza przejściem T05.

`kk-trace.mjs` dopasowuje ID w komentarzu testu, więc bez rejestracji testy tej pracy nie będą policzone jako pokrycie.

---

# CZĘŚĆ A — modale dodawania

## Kontekst kodu

**Istnieje (i jest gotowe w ~80%):**
- `apps/b2b-web/src/app/(dashboard)/auditors/components/AddAuditorModal.tsx` (391 linii) — pełny formularz: 12 pól, podgląd zdjęcia (base64 przez `FileReader`), autouzupełnianie adresu przez `usePlacesAutocomplete` (skrypt Google Maps z `libraries=places` jest ładowany globalnie w `apps/b2b-web/src/app/layout.tsx:29`, paczka `use-places-autocomplete@^4.0.1` jest w `apps/b2b-web/package.json:35`). Obsługuje też tryb edycji (`initialData`).
- `apps/b2b-web/src/app/(dashboard)/auditors/components/AddCrewModal.tsx` (199 linii) — pełny formularz: 12 pól, bez zdjęcia i bez autouzupełniania.
- Wszystkie pola obu formularzy **mają odpowiedniki w schemacie** — sprawdzone kolumna po kolumnie w `packages/database/prisma/schema.prisma` (`audytorzy` 394-435, `zespoly_monterskie` 177-212). Żadnego pola-widma tu nie ma.
- `contracts/rbac.contract.mjs:35-36`: `auditors.create: ['admin']`, `crews.create: ['admin']`. Zasoby i zdolności **już istnieją**.
- Wzorzec bramki do skopiowania: `deleteAuditorAction` / `toggleAuditorActiveAction` (`auditors/actions.ts`), `deleteCrewAction` (`crews/actions.ts`) — rola z `getCurrentActorRole()`, nigdy z argumentu.

**Brakuje — i to jest cała praca:**
1. **Oba modale to martwy kod.** `grep` po całym `apps/`: jedyne wystąpienia `AddAuditorModal` / `AddCrewModal` są w ich własnych plikach. Nikt ich nie importuje. Przy okazji martwe są też `auditors/components/AuditorsTable.tsx`, `CrewsTable.tsx`, `TopBar.tsx` (zero importów spoza katalogu `components/`).
2. **Placeholder jest w klientach widoków, nie w modalach:**
   - `auditors/auditors-client.tsx:90` — `onClick={() => alert("Dodawanie w Fazie 2")}`
   - `crews/crews-client.tsx:101` — `onClick={() => alert("Dodawanie w Fazie 2")}`
   Przycisk „Dodaj Zespół" jest w `crews/crews-client.tsx`, a modal leży w `auditors/components/` — **przycisk nie importuje tego pliku i nigdy nie importował**. Katalog jest mylący.
3. **Nie istnieje żadna Server Action tworząca audytora ani zespół.** W `auditors/actions.ts` są tylko: `getAuditors`, `toggleAuditorActiveAction`, `setSelfAvailabilityAction`, `acceptLegalDocumentVersionAction`, `deleteAuditorAction`. W `crews/actions.ts`: `getCrews`, `updateCrewAvatar`, `setSelfAvailabilityAction`, `acceptLegalDocumentVersionAction`, `deleteCrewAction`. Zero `prisma.audytorzy.create` / `prisma.zespoly_monterskie.create` w całym `apps/b2b-web`.
4. **Modale łamią ADR-001.** Oba trzymają stan w jednym `useState` z ręcznym `handleChange` i budują `FormData` ręcznie. ADR-001 wymaga `react-hook-form` + `zodResolver`, a `useState` na pola formularza jest jawnie na liście odrzuconych. Dodatkowo **`react-hook-form` i `zod` nie są zależnościami `apps/b2b-web`** — trzeba je dodać albo świadomie odstąpić. Patrz D-A1.
5. **Ścieżka zdjęcia audytora jest niespójna z istniejącym wzorcem.** `AddAuditorModal` dokleja `photoBase64` do `FormData`, natomiast działający dziś upload zdjęcia ekipy (`crews-client.tsx:33-45`) idzie przez `supabase.storage.from('zespoly').upload()` i zapisuje **ścieżkę** przez `updateCrewAvatar`, a odczyt podpisuje `signStoragePaths("audytorzy", …)` (`leads/[id]/page.tsx`). Kolumna `zdjecie_url` trzyma ścieżkę Storage, nie base64.
6. **`CrewsClient` nie dostaje `actorRole`.** `AuditorsClient` przyjmuje `actorRole` i liczy `canUpdateAuditors`/`canDeleteAuditors`, `CrewsClient({ initialCrews })` — nie. Ukrycie przycisku „Dodaj Zespół" przed nie-adminem wymaga doprowadzenia propa z `crews/page.tsx`. (Uwaga uboczna: element „Usuń (Tylko Admin)" w `crews-client.tsx` jest dziś pokazywany **wszystkim** — serwer odrzuca, ale UI kłamie. Poza zakresem, do osobnego zgłoszenia.)

## Zmiana kontraktu
**NIEWYMAGANA dla RBAC i schematu.** `auditors.create` i `crews.create` już są w `MATRIX` z rolą `['admin']`, wszystkie pola formularzy mają kolumny w schemacie.
**WYMAGANA wyłącznie rejestracja wymagań** (`CRM-AUDYT-CREATE`, `CRM-ZESP-CREATE`) w `contracts/requirements.contract.mjs` — inaczej praca nie ma ID do trace'owania.

## Kryteria akceptacji (wykonalne)
- [ ] AC-A1: Kliknięcie „Dodaj Audytora" otwiera modal formularza. Nigdzie w ścieżce tego przycisku nie pada `alert("Dodawanie w Fazie 2")`.
- [ ] AC-A2: Kliknięcie „Dodaj Zespół" w widoku Zespoły otwiera modal formularza ekipy. Ten przycisk woła komponent modala, a nie `alert`.
- [ ] AC-A3: Zapis poprawnie wypełnionego formularza audytora powoduje, że nowy audytor jest widoczny na liście `/auditors` po odświeżeniu, bez ręcznego wejścia do bazy.
- [ ] AC-A4: Zapis poprawnie wypełnionego formularza ekipy powoduje, że nowa ekipa jest widoczna na liście `/crews`.
- [ ] AC-A5: Wywołanie akcji tworzącej z rolą `dyspozytor`, `audytor` lub `monter` kończy się odmową i **nie tworzy wiersza** w bazie. Rola pochodzi z sesji serwera — podanie roli w argumencie wywołania nie zmienia wyniku.
- [ ] AC-A6: Akcja zwraca rozróżnialny wynik `{ success, error }`. Odmowa nie zamyka modala i nie pokazuje komunikatu sukcesu (dziś pięć klientów CRM ma dokładnie ten defekt — nie powielaj go).
- [ ] AC-A7: Formularz bez wymaganego pola (imię i nazwisko / nazwa ekipy) nie tworzy wiersza — walidacja odrzuca **po stronie serwera**, niezależnie od atrybutu `required` w HTML.
- [ ] AC-A8: Nowo utworzony aktywny audytor pojawia się w puli wyboru przy przypisywaniu do leada (`getAuditors()` z `leads/actions.ts`) bez restartu aplikacji.
- [ ] AC-A9: Utworzenie drugiego audytora z e-mailem już zajętym kończy się czytelnym błędem, nie surowym wyjątkiem Prismy (`audytorzy.email` i `zespoly_monterskie.email` mają `@unique`).
- [ ] AC-A10: Pusty e-mail nie jest zapisywany jako pusty łańcuch. Dwóch pracowników bez e-maila da się utworzyć (kolumna jest `NULL`-owalna i `@unique` jednocześnie — `''` przy drugim rekordzie wysadzi zapis).

## Przypadki brzegowe, które MUSZĄ mieć test
- Rola inna niż `admin` → odmowa i brak wiersza (AC-A5), osobno dla audytora i dla ekipy.
- Kolizja unikalnego e-maila (AC-A9) i dwa rekordy bez e-maila (AC-A10).
- Pola liczbowe przychodzą z `FormData` jako łańcuchy: `hvacExperience`, `radius`, `teamsCount`. Pusty łańcuch musi dać `NULL`/wartość domyślną, nie `NaN` i nie `0`.
- `brands` jedzie jako `JSON.stringify` w polu tekstowym, a kolumna `preferowane_marki` to `String[]`. Test na wartości `'[]'` i na niepoprawnym JSON-ie.
- Checkboxy (`sep`, `drillingRig`) trafiają do `FormData` jako `'true'`/`'false'` — łańcuch `'false'` jest prawdziwy w JS. Test, że odznaczony checkbox zapisuje `false`.
- Modal edycji (`initialData`) współdzieli komponent z modalem tworzenia — test, że tryb tworzenia **nie** wywołuje ścieżki update. **(ZDEZAKTUALIZOWANE 2026-08-28: edycja weszła do zakresu, patrz „CZĘŚĆ A — rozszerzenie". Zdanie „gałąź `initialData` zostaje martwa i nie wolno jej uzbroić" NIE obowiązuje. Sam test rozdzielności obu trybów zostaje i jest tym ważniejszy.)**
- Podwójne kliknięcie „Zapisz" nie tworzy dwóch audytorów.

## Poza zakresem
- ~~Edycja audytora/zespołu (`Edytuj Audytora`, `Edytuj Zespół` — nadal placeholdery). Osobne wymaganie, osobne `update` w macierzy.~~ **WYCOFANE 2026-08-28 decyzją użytkownika — edycja WCHODZI do zakresu tej tury. Patrz sekcja „CZĘŚĆ A — rozszerzenie: edycja".**
- „Zawieś Zespół" w `crews-client.tsx` (dziś element menu bez `onClick`).
- Usunięcie martwych plików `AuditorsTable.tsx`, `CrewsTable.tsx`, `TopBar.tsx`.
- Naprawa nieuwarunkowanego rolą elementu „Usuń (Tylko Admin)" w `crews-client.tsx`.
- Zakładanie konta logowania (`authorized_users`) dla nowo utworzonego pracownika. To osobna ścieżka w `settings/`; utworzenie kartoteki nie daje dostępu do panelu.
- Walidacja formatu NIP/IBAN/kodu pocztowego.

## Ryzyka i nieznane
- **D-A1 — ROZSTRZYGNIĘTE 2026-08-28 (użytkownik): wariant (a) — `react-hook-form` + `zod` + `@hookform/resolvers`, dodane jako zależności `apps/b2b-web`, oba modale przepisane zgodnie z ADR-001.**
- **D-A2 — ROZSTRZYGNIĘTE 2026-08-28 (użytkownik): upload przez Supabase Storage, NIE base64. Dotyczy OBU encji (audytor i zespół) i OBU trybów (tworzenie i edycja). `photoBase64` znika z `AddAuditorModal`.**
  Szczegóły obu decyzji, ich konsekwencje i pozostałe niewiadome — w sekcji „CZĘŚĆ A — rozszerzenie: edycja". Treść poniżej zostaje jako zapis stanu sprzed decyzji.
- **WYMAGA DECYZJI (D-A1): `react-hook-form` + `zod` czy zostawiamy `useState`?**
  ADR-001 (CLAUDE.md, tabela stosu) mówi wprost: stan formularzy to `react-hook-form` + `zodResolver`, a `useState` na pojedyncze pola jest **odrzucony**. Oba istniejące modale są napisane odrzuconym wzorcem, a obu paczek nie ma w `apps/b2b-web/package.json`. Warianty: (a) dodać zależności i przepisać oba modale zgodnie z ADR-001, (b) świadomie odstąpić dla tych dwóch modali i zapisać odstępstwo. Nie wybieram — (a) to większy zakres i nowe zależności w monorepo, (b) to jawny wyłom w ADR. Niezależnie od wyboru: walidacja Zod **po stronie Server Action** jest wymagana przez ADR-001 („Mutacje: Server Actions + walidacja Zod") i nie podlega temu wyborowi.
- **WYMAGA DECYZJI (D-A2): zdjęcie audytora — base64 do akcji czy upload do Storage jak przy ekipie?**
  Modal produkuje `photoBase64`; działający wzorzec w repo (`crews-client.tsx` + `updateCrewAvatar` + `signStoragePaths`) zapisuje do bucketu **ścieżkę**. Zapisanie base64 do `zdjecie_url` rozwali odczyt w `leads/[id]/page.tsx`, który tę wartość podaje do `signStoragePaths("audytorzy", …)`. Trzeci wariant: wyciąć zdjęcie z zakresu MVP tworzenia i zostawić upload jako osobną akcję po utworzeniu (tak działa dziś ekipa). Bucket `audytorzy` — nie zweryfikowałem, czy istnieje w Supabase Storage.
- **WYMAGA DECYZJI (D-A3): pole `adres` audytora — czy zapisujemy współrzędne?**
  `usePlacesAutocomplete` jest zaimportowane razem z `getGeocode`/`getLatLng` (linia 6), ale **nie są wołane** — `handleSelect` zapisuje sam tekst. `audytorzy` nie ma kolumn na współrzędne. Jeżeli promień dojazdu ma kiedyś liczyć odległość, potrzebne są kolumny — to zmiana schematu i okno kontraktowe. Uwaga historyczna: `apps/b2c-web/app/actions/leads.ts` już raz wstawił do `adresy` nieistniejące kolumny `lat`/`lng`; nie powtarzajmy.
- Katalog `auditors/components/` zawiera modal ekipy używany (docelowo) przez widok `crews/`. Przeniesienie pliku jest kosmetyką, ale jeśli ma nastąpić, to teraz, przed podpięciem — potem to niepotrzebny diff.

---

# CZĘŚĆ A — rozszerzenie: EDYCJA audytora i zespołu (dopisane 2026-08-28)

Rozszerzenie zakresu decyzją użytkownika. **Tworzenie i edycja idą w JEDNEJ turze**, bo współdzielą modal, schemat Zod, mapowanie `FormData → Prisma` i ścieżkę uploadu zdjęcia. Rozbicie ich na dwa przebiegi oznaczałoby napisanie tego samego mapowania dwa razy i dwa razy jego przetestowanie.

## Decyzje wejściowe (nie są już do rozstrzygnięcia)

| ID | Decyzja | Zasięg |
|---|---|---|
| D-A1 | `react-hook-form` + `zod` + `@hookform/resolvers` jako zależności `apps/b2b-web`; oba modale przepisane | oba modale, oba tryby |
| D-A2 | Zdjęcie idzie do Supabase Storage, do kolumny trafia **ścieżka**; base64 wypada | audytor **i** zespół, tworzenie **i** edycja |
| D-A4 (nowa) | Edycja wchodzi do zakresu | audytor i zespół |

**Uwaga do D-A1: `zod` nie istnieje dziś NIGDZIE w monorepo.** `grep` po wszystkich `package.json` (poza `node_modules`) nie znajduje ani `zod`, ani `react-hook-form`, ani `@hookform/resolvers`. To nie jest „dociągnięcie do `apps/b2b-web` paczki, którą repo już zna" — to wprowadzenie `zod` do monorepo po raz pierwszy, mimo że ADR-001 wymaga go od dawna („Mutacje: Server Actions + walidacja Zod"). Wersję warto ustalić raz, bo za chwilę sięgnie po nią `apps/b2c-web`.

## Kontekst kodu — co dokładnie brakuje dla EDYCJI

**Istnieje:**
- **RBAC — `update` jest już w macierzy, nic tu nie trzeba dodawać.** `contracts/rbac.contract.mjs:35-36`:
  `{ resource: 'auditors', read: ['admin','dyspozytor'], create: ['admin'], update: ['admin'], delete: ['admin'] }` oraz identycznie dla `crews`.
  **Jedyną rolą z `update` na obu zasobach jest `admin`** — `dyspozytor` ma `read`, nie ma `update`. To nie jest przeoczenie: komentarz w tym samym pliku (linie 59-61) mówi wprost, że `auditors.update`/`crews.update` **mają zostać `['admin']`**, bo inaczej pracownik terenowy odzyskałby ścieżkę do zdjęcia sobie `is_active` i `leave_status`. Nowa akcja edycji **nie może** tego rozluźnić.
- Dwie działające akcje korzystające z tej zdolności — obie **wąskie, jednokolumnowe**, obie ZOSTAJĄ bez zmian:
  - `toggleAuditorActiveAction(id)` (`auditors/actions.ts`) — przełącza **wyłącznie** `is_active`. Bramka: `can(actorRole,'auditors','update') !== 'yes'`.
  - `updateCrewAvatar(crewId, path)` (`crews/actions.ts:59-76`) — zapisuje **wyłącznie** `zdjecie_url`. Bramka: `can(actorRole,'crews','update') !== 'yes'`.
- **Działający dziś wzorzec uploadu (do skopiowania 1:1):** `crews-client.tsx:27-54`
  – klient tworzy `createClient()` z `@/utils/supabase/client`,
  – nazwa pliku: `` `${uploadingCrewId}-${Date.now()}.${ext}` `` — **unikalna przy każdym uploadzie**, plik nigdy nie jest nadpisywany,
  – `supabase.storage.from('zespoly').upload(fileName, file)`,
  – do Server Action idzie `data.path`, nie plik i nie base64.
  Odczyt: `crews/page.tsx:14` → `signStoragePaths("zespoly", crewPaths, 60*60)`; `leads/[id]/page.tsx:99` → `signStoragePaths("audytorzy", auditorPaths, 60*60)`. `signStoragePaths` (`src/lib/storage/signed-urls.ts`) chodzi przez `createAdminClient` (service role), więc **odczyt omija RLS**, a upload z przeglądarki nie.
- Bramka „rola z sesji, nigdy z argumentu": `getCurrentActorRole()` z `utils/supabase/server`. Bez wyjątków.

**Brakuje:**
1. **Nie istnieje żadna akcja aktualizująca pełny rekord.** Potrzebne są dwie nowe: `updateAuditorAction(id, formData)` i `updateCrewAction(id, formData)`, obejmujące **wszystkie 12 pól** formularza. Nie wolno rozszerzać `toggleAuditorActiveAction` ani `updateCrewAvatar` — pierwsza jest wołana z listy i musi zostać jednokolumnowa (inaczej przełączenie blokady zacznie po cichu przepisywać IBAN), druga jest wołana z menu „Wgraj zdjęcie" bez otwierania formularza i nie zna reszty pól.
2. **`initialData` nie ma czym być wypełnione — obie funkcje listujące zwracają OKROJONY rekord.** To jest najbardziej niedoszacowany element tego rozszerzenia:
   - `AuditorSummary` (`auditors/actions.ts:16-28`) **nie zawiera 7 z 12 pól formularza**: `adres`, `nazwa_firmy`, `nip`, `doswiadczenie_hvac_lata`, `kod_pocztowy_bazowy`, `iban`, `zdjecie_url`.
   - `CrewSummary` (`crews/actions.ts:8-20`) **nie zawiera 5 z 12**: `email`, `nip`, `kod_pocztowy_bazowy`, `posiada_wiertnice`, `iban`.
   Otwarcie formularza edycji na dzisiejszym obiekcie listy pokaże te pola puste i **zapisze pustkę do bazy** — cicha utrata IBAN-u i NIP-u przy każdej edycji. Zwykłe „dosypanie" brakujących kolumn do `getAuditors()`/`getCrews()` rozwiązuje to najtaniej, ale wysyła IBAN i NIP **wszystkich** pracowników do przeglądarki przy każdym wejściu na listę, dla roli `dyspozytor` włącznie (ma `read`, nie ma `update`). Patrz AC-A16 i R-A3.
3. **Audytor nie ma dziś ŻADNEJ ścieżki zdjęcia w UI.** `auditors/page.tsx` (12 linii) nie woła `signStoragePaths` w ogóle, `AuditorSummary` nie ma `zdjecie_url`, a `AddAuditorModal:68` czyta `initialData.avatarUrl`, którego nikt nie produkuje. Kolumna `audytorzy.zdjecie_url` istnieje i jest czytana **tylko** na stronie leada (`leads/[id]/page.tsx:99`). Podpięcie zdjęcia audytora to: kolumna w `getAuditors()` + `signStoragePaths("audytorzy", …)` w `auditors/page.tsx` + upload w modalu. Dla ekipy strona listy już to robi.
4. **Bucket `audytorzy` — NIEPOTWIERDZONY.** W repo nie ma ani jednej migracji tworzącej bucket (`grep` po `supabase/` na `storage.buckets`/`createBucket` — zero trafień); buckety są zakładane ręcznie w panelu Supabase. Istnienie bucketu `zespoly` potwierdza działający kod, istnienie `audytorzy` — wyłącznie literał w `leads/[id]/page.tsx:99` i w testach, co dowodzi tylko intencji. **Założenie do potwierdzenia przy implementacji, przed napisaniem uploadu audytora.** Patrz R-A1.
5. **`CrewsClient` nadal nie dostaje `actorRole`** (`crews/page.tsx` przekazuje wyłącznie `initialCrews`). Dla edycji to ten sam brak co dla tworzenia — pozycja „Edytuj Zespół" musi być warunkowana `can(actorRole,'crews','update')`, wzorem `canUpdateAuditors` w `auditors-client.tsx:38`.
6. **Oba wejścia w edycję to dziś `alert`:** `auditors-client.tsx:148` i `crews-client.tsx:154` — `onClick={() => alert("Wkrótce w Fazie 2")}`. Żaden z nich nie przekazuje rekordu do modala, bo modala nie importuje.

## Zmiana kontraktu
**NIEWYMAGANA dla RBAC i schematu.** `auditors.update` i `crews.update` już istnieją z rolą `['admin']`; wszystkie 12 pól obu formularzy ma kolumny w `schema.prisma`. Rozszerzenie o edycję **nie dokłada** nic do macierzy.
**WYMAGANA rejestracja wymagań** — do dwóch ID z Części A dochodzą dwa: `CRM-AUDYT-UPDATE`, `CRM-ZESP-UPDATE` (nazwy do zatwierdzenia). Alternatywnie `CRM-AUDYT-CREATE`/`CRM-ZESP-CREATE` mogą objąć oba tryby jednym ID — decyzja `contract-steward`, ale jeśli jednym ID, to `acceptance` musi wymieniać edycję jawnie, inaczej `kk-trace` policzy pokrycie, którego nie ma.

## Kryteria akceptacji — edycja (ciąg dalszy numeracji Części A)

- [ ] **AC-A11:** Kliknięcie „Edytuj Audytora" / „Edytuj Zespół" otwiera modal z **wypełnionymi wszystkimi 12 polami** wartościami z bazy. Nigdzie w tej ścieżce nie pada `alert("Wkrótce w Fazie 2")`.
- [ ] **AC-A12:** Zapis zmienionego formularza zmienia rekord w bazie: po odświeżeniu listy widać nową wartość, a **`id` rekordu jest to samo** (edycja, nie „usuń i utwórz").
- [ ] **AC-A13:** Otwarcie formularza edycji i zapis **bez zmiany czegokolwiek** zostawia wszystkie 12 kolumn nietknięte. W szczególności `iban`, `nip` i `kod_pocztowy_bazowy` mają po zapisie tę samą wartość co przed. (To jest test na defekt z pkt 2 — okrojony `initialData` przechodzi AC-A12 i wywraca się dopiero tutaj.)
- [ ] **AC-A14:** Wywołanie akcji edycji z rolą `dyspozytor`, `audytor` lub `monter` kończy się odmową i **nie zmienia ani jednej kolumny**. Rola pochodzi z `getCurrentActorRole()`; podanie roli w argumencie wywołania nie zmienia wyniku. Osobno dla audytora i dla ekipy. `dyspozytor` jest tu najważniejszym przypadkiem, bo **widzi** obie listy (`read`) i to jego odmowa jest nieoczywista.
- [ ] **AC-A15:** UI nie pokazuje pozycji „Edytuj" roli bez `update` — dotyczy też widoku Zespołów, który dziś nie zna `actorRole`. (Serwer i tak odrzuca; chodzi o to, żeby UI nie kłamał — ten sam defekt co „Usuń (Tylko Admin)" pokazywane wszystkim.)
- [ ] **AC-A16:** Payload listy audytorów i listy ekip dostarczony do przeglądarki **nie zawiera `iban` ani `nip` żadnego pracownika** — pod żadną nazwą pola. Dane wrażliwe do formularza edycji są pobierane dopiero przy otwarciu modala, dla **jednego** rekordu, akcją z bramką `update`. (Zawężenie w `select` zapytania, nie w `map` po nim — wzorem `SEC-ASSIGNMENT-POOL-MINIMIZE`. Jeśli po decyzji człowieka wybrany zostanie wariant „poszerz listę", to AC trzeba świadomie wykreślić, a nie przemilczeć.)
- [ ] **AC-A17:** Zmiana e-maila na adres zajęty przez **inny** rekord kończy się czytelnym komunikatem, a nie surowym wyjątkiem Prismy (`P2002`). Rekord pozostaje niezmieniony w całości — nie tylko w kolumnie `email`.
- [ ] **AC-A18:** Zapis formularza edycji z **niezmienionym własnym** e-mailem **kończy się sukcesem**. To jest test regresyjny na ręczne sprawdzenie kolizji: naiwne `findUnique({ where: { email } })` przed zapisem znajduje **własny rekord** i fałszywie odrzuca każdą edycję pracownika, który e-mail w ogóle ma. Jeżeli sprawdzenie wstępne w ogóle istnieje, musi wykluczać `id` edytowanego rekordu (`NOT: { id }`); wariant zalecany — **nie robić sprawdzenia wstępnego wcale** i obsłużyć `P2002` z `prisma.update`, bo tylko baza rozstrzyga to bez wyścigu.
- [ ] **AC-A19:** Wyczyszczenie e-maila w edycji zapisuje `NULL`, nie `''`. Dwóch pracowników z wyczyszczonym e-mailem współistnieje (kolumna jest `NULL`-owalna **i** `@unique` — drugi `''` wysadza zapis). Odpowiednik AC-A10 dla trybu edycji.
- [ ] **AC-A20:** Wgranie nowego zdjęcia w trybie edycji: kolumna `zdjecie_url` wskazuje **nowy** obiekt Storage, lista pokazuje nowe zdjęcie po odświeżeniu. **Stary plik w bucketcie NIE jest usuwany** — dzisiejszy `updateCrewAvatar` tylko podmienia ścieżkę, a nazwa pliku zawiera `Date.now()`, więc nadpisanie jest niemożliwe z założenia. Zachowaj tę semantykę; osierocone obiekty to znany, świadomy dług (patrz „Poza zakresem"). Test ma **stwierdzić** brak kasowania, nie go naprawiać.
- [ ] **AC-A21:** Zapis formularza edycji **bez dotykania zdjęcia** zostawia `zdjecie_url` bez zmian. W szczególności nie ustawia `NULL` dlatego, że pole pliku było puste. To najczęstszy sposób, w jaki formularz edycji kasuje awatary.
- [ ] **AC-A22:** Nieudany upload do Storage (np. odmowa RLS na `storage.objects`) **nie zapisuje rekordu z pustą ani błędną ścieżką**: albo cała edycja jest odrzucona z komunikatem, albo pozostałe pola zapisują się, a `zdjecie_url` pozostaje poprzednie. Wariant „`zdjecie_url` = `undefined` przemycone do `update`" jest niedopuszczalny w obu trybach.
- [ ] **AC-A23:** Edycja nieistniejącego `id` (rekord usunięty w innej karcie) zwraca czytelny błąd, nie tworzy nowego rekordu i nie wywala 500. Wzorem `toggleAuditorActiveAction`, które sprawdza istnienie przed zapisem.
- [ ] **AC-A24:** Tryb tworzenia i tryb edycji są rozłączne: submit bez `initialData` wywołuje **wyłącznie** akcję `create`, submit z `initialData` — **wyłącznie** akcję `update`. Zapis w trybie edycji nie tworzy drugiego rekordu.

## Przypadki brzegowe — edycja (analogicznie do listy dla tworzenia)

- **Checkboxy w trybie edycji.** `sep`, `drillingRig` (`posiada_wiertnice`), a przy audytorze `sep` — do `FormData` idą przez `String(value)`, czyli `'true'`/`'false'`, a `'false'` jest w JS prawdziwe. Test **odznaczenia** wcześniej zaznaczonego checkboxa: `true → false` musi się zapisać. To jest gorszy przypadek niż przy tworzeniu, bo przy tworzeniu domyślną wartością kolumny jest `false` i błąd się maskuje.
- **`brands` / `preferowane_marki`.** Kolumna to `String[]`, formularz wiezie `JSON.stringify` w polu tekstowym; `AddAuditorModal:62` robi `JSON.stringify(initialData.preferowane_marki || [])`. Testy: edycja niepustej listy na `'[]'` (musi wyczyścić, nie zignorować), oraz niepoprawny JSON (musi odrzucić, nie zapisać `[]` po cichu — to cicha utrata danych, inaczej niż przy tworzeniu).
- **Puste pola liczbowe.** `hvacExperience` (`doswiadczenie_hvac_lata`), `radius` (`max_promien_dojazdu_km` / `promien_dzialania_km`), `teamsCount` (`liczba_brygad`). Wyczyszczenie pola liczbowego w edycji musi dać `NULL`, nigdy `NaN` (Prisma odrzuci) i nigdy `0` (cicha zmiana danych — promień `0 km` znaczy „ekipa nigdzie nie dojedzie" i wypadnie z przyszłych filtrów). `liczba_brygad` ma `@default(1)` i jest **NOT NULL** — puste pole musi dać `1`, nie `NULL`.
- **Uprawnienia — pełna macierz.** Cztery role × dwie encje × wywołanie z pominięciem UI. `dyspozytor` osobno wymieniony, bo widzi listę.
- **Kolizja e-maila w obie strony:** cudzy e-mail (odmowa, AC-A17) i własny niezmieniony (sukces, AC-A18). Trzeci przypadek: dwaj admini edytują dwa rekordy równolegle, obaj ustawiają ten sam wolny e-mail — jeden musi dostać czytelny błąd, nie 500.
- **Współbieżność:** dwóch adminów edytuje ten sam rekord z dwóch kart. Wynik to komplet pól jednego z nich, nigdy mieszanka. Formularz wysyła wszystkie 12 pól, więc „ostatni wygrywa" jest akceptowalne — ale test ma to **stwierdzić**, bo cichy nadpis cudzej zmiany jest tu realny i nikt go dziś nie widzi (brak `updated_at`, brak wersjonowania).
- **Wyścig edycja ↔ usunięcie:** `deleteAuditorAction`/`deleteCrewAction` wykonane między otwarciem modala a zapisem (AC-A23).
- **Wyścig edycja ↔ `toggleAuditorActiveAction`:** admin blokuje audytora z listy, gdy w drugiej karcie otwarty jest formularz edycji. Zapis formularza **nie może** cofnąć `is_active` — a cofnie, jeśli akcja edycji wyśle `is_active` z `initialData`. Wniosek do testu: **`is_active` i `leave_status` NIE należą do 12 pól formularza i nie mogą znaleźć się w `data` akcji edycji.** To ta sama granica, którą chroni komentarz w `rbac.contract.mjs:59-61`.
- **Podwójne kliknięcie „Zapisz" w edycji** — jeden zapis, brak drugiego rekordu (AC-A24).
- **Upload zdjęcia:** plik nie-obrazowy, plik bardzo duży, anulowanie okna wyboru pliku (musi zostawić `zdjecie_url` bez zmian — AC-A21).

## Poza zakresem (rozszerzenia)
- **Kasowanie osieroconych obiektów w Storage** po podmianie zdjęcia. Świadomy dług, spójny z dzisiejszym `updateCrewAvatar`. Osobne zgłoszenie (retencja + RODO).
- **Naprawa RLS na `storage.objects`** — patrz R-A2. Jeśli upload nie działa, to jest istniejący bug, nie regresja tej pracy; poprawka wymaga migracji i roli `contract-steward`.
- Edycja `is_active` / `leave_status` / dostępności z tego formularza. Mają własne, wąskie ścieżki (`toggleAuditorActiveAction`, `setSelfAvailabilityAction`) i mają takie zostać.
- Kolumna `updated_at` / historia zmian / wpis do `audit_log` przy edycji kartoteki. `AUDIT_REQUIREMENTS.mustLog` nie wymienia zwykłej edycji kartoteki (`delete`, `anonymize`, `role_change`, `contract_override`, `manual_status_change`, `notification_resend`) — nie dokładamy tego przy okazji.
- Walidacja formatu NIP/IBAN/kodu pocztowego (bez zmian wobec Części A).
- Zmiana e-maila w `authorized_users` przy zmianie e-maila kartoteki. **Uwaga, to nie jest kosmetyka:** e-mail jest kluczem powiązania „czyj to rekord" w `setSelfAvailabilityAction`, `acceptLegalDocumentVersionAction` i w `middleware.ts:89`. Zmiana e-maila w kartotece **zrywa** to powiązanie i pracownik traci samoobsługę oraz — przy audytorze — może obejść blokadę logowania. Poza zakresem, ale **musi trafić do osobnego zgłoszenia razem z tym WO**, nie po cichu.

## Ryzyka i nieznane (rozszerzenia)
- **R-A1 — WYMAGA POTWIERDZENIA (nie decyzji projektowej): czy bucket `audytorzy` istnieje w Supabase Storage?** Repo nie zakłada bucketów migracją, więc z kodu tego nie da się rozstrzygnąć. Sprawdzić w panelu Supabase **przed** implementacją uploadu audytora. Jeśli nie istnieje — trzeba go założyć (i rozstrzygnąć, czy zakładanie bucketów ma wejść do migracji, żeby środowiska się nie rozjeżdżały). Nazwę `audytorzy` narzuca istniejący odczyt w `leads/[id]/page.tsx:99`; zmiana nazwy zepsułaby stronę leada.
- **R-A2 — upload zdjęcia z przeglądarki może dziś w ogóle nie działać.** Migracja `20260824185845_security_enable_rls_baseline.sql` mówi wprost w sekcji „ZAKRES ŚWIADOMIE POMINIĘTY": *„`storage.objects` — RLS włączone, zero polityk; upload awatara ekipy (crews-client.tsx, supabase.storage.from('zespoly')) najprawdopodobniej dziś nie działa. To osobny bug funkcjonalny…"*. Odczyt działa, bo `signStoragePaths` idzie przez service role. **Konsekwencja: kopiujemy wzorzec, który jest udokumentowany jako prawdopodobnie zepsuty.** Zweryfikować empirycznie zanim upload trafi do AC uznanych za spełnione — inaczej AC-A20 „przejdzie" na mocku i wywali się na produkcji. Jeśli faktycznie nie działa, jedyną alternatywą bez migracji jest upload przez Server Action z kluczem service role po stronie serwera (klucz **nie może** trafić do klienta).
- **R-A3 — WYMAGA DECYZJI: skąd formularz edycji bierze pełny rekord?** Dwa warianty, oba mają cenę:
  (a) **poszerzyć `getAuditors()`/`getCrews()`** o brakujące kolumny — najtańsze, ale IBAN i NIP wszystkich pracowników lądują w przeglądarce przy każdym wejściu na listę, także u roli `dyspozytor`, która nie ma prawa edycji. To dokładnie ta klasa nadmiarowego pobrania, którą repo już raz naprawiało (`SEC-LEADS-LIST-MINIMIZE`, `SEC-ASSIGNMENT-POOL-MINIMIZE`);
  (b) **osobna akcja `getAuditorForEdit(id)`/`getCrewForEdit(id)`** z bramką `update`, wołana przy otwarciu modala — jeden rekord, jedno dodatkowe zapytanie, modal ładuje się asynchronicznie (drobna zmiana w UI: stan „ładowanie" w modalu).
  **Rekomenduję (b)** i tak sformułowałem AC-A16, ale wyboru nie dokonuję — (b) to nieco większy zakres UI. Jeśli człowiek wybierze (a), AC-A16 trzeba wykreślić świadomie.
- **R-A4 — `dyspozytor` widzi listy, ale nie może nic edytować.** To wynik obowiązującej macierzy, nie błąd. Jeśli intencją biznesową jest, żeby dyspozytor edytował kartoteki, to jest **zmiana kontraktu** (`contract-steward` + okno kontraktowe) i wprost sprzeczna z komentarzem uzasadniającym `['admin']` w `rbac.contract.mjs:59-61`. Nie rozstrzygam i nie zakładam — WO pisany jest na dzisiejszą macierz.
- **R-A5 — brak `updated_at` na obu tabelach.** Nie da się wykryć nadpisania cudzej równoległej edycji ani pokazać „ostatnio zmieniono". Dodanie kolumny to zmiana schematu i okno kontraktowe — poza zakresem, ale to jest powód, dla którego przypadek współbieżności może zostać tylko *stwierdzony* testem, a nie *rozwiązany*.
- **R-A6 — przepisanie modali na `react-hook-form` (D-A1) dotyka też trybu tworzenia**, który był już opisany w Części A. To jeden diff na plik, nie dwa. Zakres łączny (2 modale × 2 tryby + 4 Server Actions + upload dla 2 encji + `actorRole` do `CrewsClient` + zdjęcie audytora end-to-end) jest **duży jak na limit 3 iteracji GREEN**. Zalecana kolejność wewnątrz tury: (1) zależności + schematy Zod, (2) Server Actions `create` i `update` z bramkami — bez UI, (3) podpięcie modali i uploadu. Jeśli po drugiej iteracji GREEN nie ma zielonego, zdjęcie audytora (pkt 3 kontekstu) jest najlepszym kandydatem do odcięcia — nie ma go dziś w UI w ogóle, więc jego brak niczego nie psuje.

---

# CZĘŚĆ B — przypisywanie EKIPY do leada analogicznie do audytora

## Kontekst kodu

### Wzorzec audytora (co dokładnie robi)
- Tabela: `leady.audytor_id` — **kolumna wprost na leadzie** (`schema.prisma:90-91`, `onDelete: SetNull`).
- Akcja: `updateLeadAuditor(leadId, audytorId | null)` w `leads/[id]/actions.ts:77-118`. Bramka `can(role,'leads','update')==='yes'`, odrzuca audytora z `is_active: false`, jeden `prisma.leady.update`.
- **Uwaga: ta akcja NIE jest neutralna statusowo.** Linie 97-102: przypisanie przy `NEW_LEAD` przestawia status na `AWAITING_AUDIT`, odpięcie przy `AWAITING_AUDIT` cofa do `NEW_LEAD`. Robi to **z pominięciem** `canTransition`/`findTransition` z kontraktu — inaczej niż `assignCrewToLead`, `returnToFunnel` i `archiveLost` w `leads/actions.ts`. To istniejący rozjazd kod↔kontrakt, nie wzorzec do naśladowania.
- Dwa punkty wejścia:
  - Tabela: `leads-client.tsx:361-420` — `DropdownMenu` w kolumnie audytora, `handleAssignAuditor` (`:189-213`) robi optymistyczną aktualizację i woła `updateLeadAuditor`. Dostępny **przy każdym statusie**, bez żadnego warunku.
  - Szczegóły: `leads/[id]/assign-auditor.tsx` — karta „Zarządzanie", montowana w `leads/[id]/page.tsx:260`, pula z `getAuditors()` (`leads/actions.ts:78`) + podpisane avatary.

### Stan ekipy (co jest, a czego nie ma)
- **`leady` NIE MA kolumny `zespol_id`.** Ekipa żyje na `instalacje.zespol_id` (`schema.prisma:234-235`), relacja `leady 1—N instalacje`, `instalacje.lead_id` jest **NOT NULL**. To zasadnicza różnica strukturalna wobec audytora.
- Wyświetlanie w tabeli: `leads-client.tsx:327` — `lead.instalacje?.[0]?.zespol?.nazwa || "Brak"`, kolumna czysto tekstowa, bez żadnej interakcji. **Bierze pierwszą instalację z tablicy, bez sortowania** — przy dwóch instalacjach pokazuje niedeterministycznie jedną z nich.
- Przypisanie: **wyłącznie** `AssignCrewDialog` (`leads/assign-crew-dialog.tsx`), otwierany z menu „…" pod etykietą „Przydział ekipy (E4)" (`leads-client.tsx:483-495`), pod warunkiem `isE4 = lead.status === "AWAITING_CREW_ASSIGNMENT"` (`:446`).
- Akcja: `assignCrewToLead(leadId, crewId)` (`leads/actions.ts:159-244`). Jest **twardo zawężona do przejścia T05**:
  - `:172` — odrzuca, jeśli `status !== "AWAITING_CREW_ASSIGNMENT"`,
  - `:175` — odrzuca, jeśli brak `data_rezerwacji` (bez daty nie da się sprawdzić certyfikatów),
  - `:211-214` — `canTransition("AWAITING_CREW_ASSIGNMENT","assignCrew")` + `findTransition`, status docelowy z kontraktu,
  - `:219-236` — transakcja: `leady.update({ status: transition.to })` **oraz** `instalacje` update-albo-create z `zespol_id`.
  Kontrakt (`funnel.contract.mjs`, T05) przenosi `AWAITING_CREW_ASSIGNMENT → HARDWARE_IN_WAREHOUSE`, `guards: ['crewCertsValid','crewCalendarFree']`, `effects: ['I3','do:createShipmentOrder']`.
  **Wniosek: tej funkcji nie da się użyć jako ogólnego mechanizmu przypisania.** Każde wywołanie poza E4 zwraca „Lead nie oczekuje na przypisanie ekipy", a każde wywołanie w E4 przesuwa lead do E5 i (docelowo) odpala I3 + zamówienie wysyłki. To nie jest „ustaw pole".
- Pula: `getCrews(installationDate)` (`leads/actions.ts:111-152`) — **wymaga daty montażu jako argumentu obowiązkowego**, filtruje po `aktywny`, ważności certyfikatów na tę datę i deklaracji dostępności.
- Strona szczegółów leada: **nie pokazuje ekipy w ogóle**. `getLeadDetail` (`leads/[id]/actions.ts:55-58`) robi `include: { klient: true, adres: true }` — bez `instalacje`. Nie ma żadnego odpowiednika `assign-auditor.tsx` dla ekipy. To komponent do napisania od zera plus rozszerzenie zapytania.
- Homonim, na który trzeba uważać: `installations/actions.ts:assignCrew` — martwy kod bez wywołań, to nie jest ta akcja.

## Zmiana kontraktu
**WYMAGANA, w zakresie zależnym od decyzji D-B1 i D-B2.**
- Rejestracja wymagania `CRM-LEAD-CREW-ASSIGN` — zawsze.
- Jeżeli D-B1 = „kolumna na leadzie": zmiana `schema.prisma` + migracja Supabase → **okno kontraktowe i rola `contract-steward`**.
- Jeżeli D-B2 = „nowa akcja neutralna statusowo": kontrakt lejka prawdopodobnie **nie** wymaga zmiany, bo taka akcja nie realizuje żadnego przejścia. Ale trzeba to zapisać jawnie, bo dziś jedynym opisem przypisania ekipy w kontrakcie jest T05, którego semantyka to „przypisz **i** przesuń do E5".
- RBAC: `leads.update = ['admin','dyspozytor']` — wystarczy, nowego zasobu nie potrzeba.

## WYMAGA DECYZJI — dwa pytania architektoniczne, których nie rozstrzygam

### D-B1 — gdzie mieszka „ekipa przypisana do leada"?
**Wariant 1: nowa kolumna `leady.zespol_id`** (symetria z `audytor_id`).
- Za: przypisanie działa w każdym statusie, także zanim istnieje instalacja; tabela i strona szczegółów czytają jedno pole; brak niedeterminizmu „która instalacja".
- Przeciw: **zmiana schematu i migracja** (okno kontraktowe); powstają **dwa źródła prawdy** o ekipie — `leady.zespol_id` i `instalacje.zespol_id`. Trzeba rozstrzygnąć, które wygrywa i czy `assignCrewToLead` zapisuje odtąd oba. Rozjazd tych dwóch pól to przyszły incydent typu „ekipa jedzie pod adres, o którym nie wie".

**Wariant 2: operowanie na `instalacje.zespol_id`** (bez migracji).
- Za: brak zmiany schematu; jedno źródło prawdy; `assignCrewToLead` już dziś tak robi (`:225-235`) — jest gotowy wzorzec „update istniejącej albo create".
- Przeciw: przypisanie ekipy dla leada w `NEW_LEAD` **tworzy wiersz `instalacje` ze statusem `PLANNED`**, który natychmiast pojawi się w widoku Instalacji, w `getCrews()` z `crews/actions.ts` (licznik `installationsCount`), w blokadzie usunięcia ekipy (`deleteCrewAction` blokuje na `PLANNED`) i prawdopodobnie w alertach dnia montażu. Powstaje „instalacja duch" dla leada, który nawet nie przeszedł audytu. To realny efekt uboczny, nie kosmetyka. Dodatkowo: odpięcie ekipy (`null`) zostawia pusty wiersz instalacji — trzeba zdecydować, czy go kasować.

**Wariant 3: przypisanie ogólne jest dostępne dopiero od momentu, gdy instalacja istnieje** (czyli od E4 wzwyż), a wcześniej UI pokazuje „Brak" bez możliwości wyboru.
- Za: zero migracji, zero instalacji duchów.
- Przeciw: **nie realizuje zadania** tak, jak zostało postawione („analogicznie do audytora, w każdym momencie"). Wymieniam, bo może być tym, czego naprawdę potrzeba — audytor przypisywany na E1 ma sens biznesowy (on jedzie na audyt), ekipa na E1 nie ma jeszcze czego montować.

### D-B2 — czy nowe punkty wejścia wołają istniejące `assignCrewToLead`, czy nową akcję bez efektu ubocznego?
**Wariant A: reużycie `assignCrewToLead`.** Wtedy dropdown w tabeli i karta na szczegółach działają **tylko** w statusie `AWAITING_CREW_ASSIGNMENT` i tylko przy ustawionej `data_rezerwacji`, a każde przypisanie przesuwa lead do `HARDWARE_IN_WAREHOUSE`. Czyli: ładniejszy UI dla dzisiejszej funkcji, nie nowa funkcja. Nie da się też zmienić ekipy po fakcie — po przejściu do E5 akcja odrzuca.

**Wariant B: nowa akcja, np. `updateLeadCrew(leadId, crewId | null)`, neutralna statusowo.** Symetryczna do `updateLeadAuditor`. Wtedy trzeba rozstrzygnąć dodatkowo:
- Czy walidacja certyfikatów obowiązuje? Bez `data_rezerwacji` **nie ma jak** ich sprawdzić (`invalidCrewCerts` wymaga daty), a `getCrews()` wymaga jej jako argumentu. Warianty: sprawdzać na `data_rezerwacji` gdy jest i przepuszczać gdy jej nie ma (fail-open — sprzeczne z `CRM-ZESP-AC2`, którego AC brzmi „odrzucenie po stronie serwera przy próbie ręcznego wymuszenia"), albo sprawdzać na „dziś", albo nie sprawdzać wcale i uznać przypisanie wstępne za niewiążące do momentu T05.
- Czy `T05 assignCrew` ma odtąd **wymagać** wcześniej przypisanej ekipy, czy nadal wybierać ją samodzielnie? Dwie ścieżki zapisujące to samo pole to dokładnie ta klasa rozjazdu, którą to repo już ma w kilku miejscach.
- Czy odpięcie ekipy (`null`) jest w ogóle dozwolone po przejściu do E5+, gdzie zamówienie wysyłki już poszło?

**Wariant C: obie ścieżki, rozdzielone semantycznie** — „ekipa proponowana" (dowolny moment, bez skutków) osobno od „ekipa zatwierdzona w T05" (ze skutkami). To wymaga osobnego pola i jest największym zakresem; wymieniam dla kompletności.

Nie wybieram żadnego wariantu. D-B1 i D-B2 są **sprzężone**: wariant D-B1/2 z D-B2/B daje instalacje duchy dla leadów w E1, a D-B1/1 z D-B2/A jest wewnętrznie sprzeczny (nowa kolumna, której nikt poza E4 nie zapisuje).

## Kryteria akceptacji (wykonalne) — do doprecyzowania po decyzjach

Poniższe są niezależne od wyboru wariantu i obowiązują zawsze:
- [ ] AC-B1: Kolumna „Zespół" w tabeli leadów jest klikalna i otwiera listę wyboru ekipy — tak jak dziś działa kolumna audytora.
- [ ] AC-B2: Strona szczegółów leada pokazuje aktualnie przypisaną ekipę (lub „Brak") — dziś nie pokazuje jej wcale.
- [ ] AC-B3: Strona szczegółów leada pozwala przypisać i zmienić ekipę bez wychodzenia do listy.
- [ ] AC-B4: Zmiana ekipy z jednego miejsca jest widoczna w drugim po odświeżeniu (jedno źródło prawdy, nie dwa równoległe zapisy).
- [ ] AC-B5: Rola `audytor` i `monter` nie może przypisać ekipy — akcja odrzuca, a UI nie pokazuje kontrolki (wzorem `canUpdateLeads` w `leads-client.tsx:134`).
- [ ] AC-B6: Odmowa jest odróżnialna od sukcesu w UI: optymistyczna aktualizacja cofa się, użytkownik widzi treść błędu (wzorem `assign-auditor.tsx:28-31`).
- [ ] AC-B7: Pula ekip przekazana do przeglądarki zawiera wyłącznie pola renderowane przez nowe komponenty — żadnego `iban`, NIP, adresu, telefonu, e-maila ani bazowego kodu pocztowego, pod żadną nazwą. Zawężenie jest w `select` zapytania, nie w `map` po nim. (Dziedziczone z `SEC-ASSIGNMENT-POOL-MINIMIZE`; nowy konsument nie może rozszerzyć zestawu.)
- [ ] AC-B8: Ekipa nieaktywna (`aktywny: false`) nie występuje w puli wyboru **i** jest odrzucana po stronie serwera przy podaniu jej `id` wprost, z pominięciem UI.
- [ ] AC-B9: Istniejąca ścieżka E4 (`AssignCrewDialog` + `assignCrewToLead`) nadal działa i nadal przenosi lead do `HARDWARE_IN_WAREHOUSE`; istniejące testy `crews-cert-availability.test.ts` przechodzą bez zmian.
- [ ] AC-B10: Lead z dwiema instalacjami wyświetla ekipę deterministycznie (dziś `instalacje[0]` bez `orderBy` — dowolna).

Po decyzjach dojdą AC dla: momentu dostępności kontrolki, walidacji certyfikatów przy braku `data_rezerwacji`, tworzenia/kasowania wiersza `instalacje` i zachowania przy odpięciu.

## Przypadki brzegowe, które MUSZĄ mieć test
- **Współbieżność:** dwóch dyspozytorów przypisuje różne ekipy do tego samego leada równocześnie. Wynik musi być jedną z dwóch ekip, nigdy stanem pośrednim (rozjazd `leady` ↔ `instalacje`, jeśli D-B1/1). Zapis statusu i zapis przypisania w **jednej transakcji** — wzorem `:219-236`.
- **Idempotencja:** ponowne przypisanie tej samej ekipy nie tworzy drugiego wiersza `instalacje` i nie przesuwa statusu drugi raz.
- **Wyścig z certyfikatem:** certyfikat wygasa między wyrenderowaniem listy a kliknięciem — serwer odrzuca (przypadek już opisany w `assign-crew-dialog.tsx:77`, musi przetrwać).
- **Wyścig z usunięciem ekipy:** `deleteCrewAction` blokuje na instalacjach `PLANNED`/`IN_PROGRESS`; przypisanie ekipy równolegle z jej usuwaniem nie może zostawić `zespol_id` wskazującego na nieistniejący wiersz (relacja ma `SetNull`, więc „cicho zniknie" — test musi to pokazać, nie przemilczeć).
- **Uprawnienia:** wywołanie akcji wprost z przeglądarki, z pominięciem UI, dla każdej z czterech ról. Rola z sesji, nigdy z argumentu.
- **Odpięcie ekipy** (`null`) w każdym statusie od E4 wzwyż — czy dozwolone i co się dzieje z wierszem instalacji.
- **Strefy czasowe:** `invalidCrewCerts` porównuje `fgaz_valid_until`/`sep_valid_until` (typ `@db.Date`) z `data_rezerwacji` (`@db.Timestamptz`). Montaż o 23:00 w dniu wygaśnięcia certyfikatu — test graniczny na dzień ważności.
- **Lead bez `data_rezerwacji`** — dziś twarda odmowa. Nowe zachowanie zależy od D-B2 i musi mieć test niezależnie od wyboru.

## Poza zakresem
- Guard `crewCalendarFree` z T05 — nie jest dziś zaimplementowany w `assignCrewToLead` (sprawdzane są tylko certyfikaty). Osobne wymaganie, dotyka silnika dostępności (faza 4 mapy Field App).
- Efekty T05 `I3` i `do:createShipmentOrder` — nie ma ich dziś w kodzie akcji. Nie domykamy ich przy okazji.
- `installations/actions.ts:assignCrew` (martwy homonim) — nie ruszamy, nie usuwamy w tym WO.
- Widok Instalacji i przepinanie ekipy z jego poziomu.
- Przydział brygady serwisowej (`incidents-client.tsx:112`, `services-client.tsx:155` — nadal placeholdery „Fazie 2"). Inna encja (`serwisy.zespol_id`), inne wymaganie.
- `getLeads()` nadal pobiera nadmiarowo (`SEC-LEADS-LIST-MINIMIZE` osobno) — nowa kolumna nie jest pretekstem do jego przepisania.

## Ryzyka i nieznane
- Kontrakt lejka zna **jedno** przypisanie ekipy: T05, ze skutkiem przesunięcia statusu i wysyłką. Dokumenty (`b2b_crm_specifications.md#6`, wymagania `CRM-ZESP-AC1..AC3`) mówią wyłącznie o puli w E4 i o kalendarzu. **Żaden dokument w repo nie opisuje przypisania ekipy poza E4** — to nie jest sprzeczność między dokumentami, tylko luka. Zadanie pochodzi od użytkownika, nie ze specyfikacji, więc semantyka biznesowa musi zostać dopisana świadomie, a nie wywnioskowana.
- `updateLeadAuditor` przestawia status z pominięciem `canTransition` — jeżeli nowa akcja ekipy ma być „analogiczna", skopiuje ten dług. Zalecam, żeby decyzja D-B2 wprost powiedziała, czy nowa akcja ma być statusowo neutralna (wtedy problem znika), czy ma przechodzić przez kontrakt.
- Nie zweryfikowałem, czy `leads/page.tsx` da się rozsądnie zasilić pulą ekip: `getCrews()` z `leads/actions.ts` wymaga **jednej** daty montażu jako argumentu, a lista leadów ma N różnych dat (lub ich brak). Pula per-wiersz to N zapytań; pula wspólna wymaga innej sygnatury funkcji. To jest realny koszt wariantu D-B2/B i trzeba go wycenić przed startem.
- `apps/b2b-web` nie importuje `@klikklima/contracts` w warstwie UI poza `can()` — maszyna stanów w `ALLOWED_TRANSITIONS`/`CONTEXT_ACTIONS` (`leads-client.tsx:73-111`) jest równoległa wobec `funnel.contract.mjs`. Każda zmiana zachowania statusowego musi być naniesiona w obu miejscach albo w żadnym.

---

## Kolejność pracy (propozycja)

Część A i część B są **rozłączne** i powinny iść jako dwa osobne przebiegi pętli — łączny zakres przekracza limit 3 iteracji GREEN.
Część A jest gotowa do startu **po** rozstrzygnięciu D-A1/D-A2 i rejestracji dwóch wymagań.
**Aktualizacja 2026-08-28:** D-A1 i D-A2 są rozstrzygnięte, a zakres Części A obejmuje odtąd **tworzenie i edycję** (D-A4). Otwarte przed startem zostają: rejestracja wymagań (teraz czterech, patrz „CZĘŚĆ A — rozszerzenie"), potwierdzenie R-A1 (bucket `audytorzy`), weryfikacja R-A2 (RLS na `storage.objects`) i decyzja R-A3 (skąd formularz edycji bierze pełny rekord).
Część B jest **zablokowana** do czasu rozstrzygnięcia D-B1 i D-B2; przed nimi nie ma sensu pisać ani testów, ani kodu.

---

# ERRATA A-2 (2026-08-31) — brakujące daty ważności certyfikatów w formularzach kartotek

Zgłoszenie użytkownika: formularze „Dodaj/Edytuj Zespół" i „Dodaj/Edytuj Audytora" nie mają pól `fgaz_valid_until` / `sep_valid_until`, więc nowo założony rekord ma je `NULL`.

## Wymagania: CRM-ZESP-KARTOTEKA, CRM-AUDYT-KARTOTEKA (oba wymagają korekty `acceptance` — patrz „Zmiana kontraktu")

## Ustalenia (zweryfikowane w kodzie 2026-08-31)

1. **To jest błąd rejestracji wymagania, nie tylko implementacji.** Oba wpisy w `contracts/requirements.contract.mjs` mówią w `statement` „komplet **12 pól** kartoteki", a kryteria akceptacji wyliczają pola imiennie (AC-A11/AC-A13: „WSZYSTKIMI 12 polami"). Dwie kolumny dat ważności nie występują w żadnym kryterium ani po stronie audytora, ani zespołu. Implementer zbudował dokładnie to, co było zarejestrowane. Naprawa samego kodu bez korekty kontraktu zostawiłaby kryteria mówiące „12", podczas gdy formularz ma 14 pól.

2. **Semantyka `NULL` — dla ZESPOŁU zgłoszenie jest trafne, dla AUDYTORA nie.**
   `apps/b2b-web/src/app/(dashboard)/leads/actions.ts:44-57`:
   ```ts
   function isCertValidForDate(validUntil: Date | null, referenceDate: Date): boolean {
     if (!validUntil) return false;   // NULL = NIEWAŻNY (fail-closed, D6)
     return dateOnlyIso(validUntil) >= dateOnlyIsoInWarsaw(referenceDate);
   }
   ```
   `invalidCrewCerts()` jest wołane w dwóch miejscach: w `getCrews(installationDate)` (filtr puli, linia 137) i ponownie w `assignCrewToLead` (linia 193, przed zapisem). Zespół z `NULL` **nigdy nie pojawi się w puli i nie da się go przypisać** — pełna blokada, dokładnie jak opisał użytkownik.
   **Dla audytora analogicznej funkcji NIE MA.** `getAuditors()` (`leads/actions.ts:79-99`) filtruje wyłącznie po `is_active` i `availability_declaration`; nie pobiera `fgaz_valid_until` ani `sep_valid_until` i nie sprawdza certyfikatów w ogóle. Jedyny konsument `fgaz_valid_until` po stronie audytora to `AuditorSummary` (`auditors/actions.ts:21,51`) → plakietka ostrzegawcza „wygasa za N dni" w `auditors-client.tsx:220-221`, gdzie `NULL` daje po prostu brak plakietki. `sep_valid_until` audytora nie jest dziś czytane NIGDZIE.
   **Wniosek:** dla audytora nie ma regresji funkcjonalnej — jest luka danych (nie da się udokumentować ważności, plakietka milczy). Nie wolno przy okazji dorabiać audytorowi bramki certyfikatowej: to byłaby nowa reguła biznesowa bez źródła w dokumentach (patrz „Poza zakresem").

3. **Parowanie pól.** `certyfikat_fgaz` to `String?` — numer/oznaczenie certyfikatu (renderowany jako tekst w `crews-client.tsx:288`). `uprawnienia_sep` to `Boolean` — „ma / nie ma". `fgaz_valid_until` i `sep_valid_until` to `DateTime? @db.Date` na obu modelach (`schema.prisma:203-204` dla `zespoly_monterskie`, `418-419` dla `audytorzy`). Są to logicznie pary: numer/flaga + data ważności. Muszą stać obok siebie.

4. **Brak wzorca pola daty w repo.** `grep 'type="date"'` w `apps/b2b-web/src` nie zwraca ani jednego trafienia. To pierwszy formularz z datą w panelu — mapowanie trzeba ustalić tutaj, bo stanie się wzorcem.

## Kontekst kodu
- Istnieje: kolumny w schemacie (obie encje), `isCertValidForDate`/`invalidCrewCerts` (`leads/actions.ts`), odczyt `fgaz_valid_until` w `AuditorSummary`, plakietka w `auditors-client.tsx`.
- Brakuje: inputów w `AddCrewModal.tsx` i `AddAuditorModal.tsx`, pól w schematach Zod obu modali, mapowania w `createCrewAction`/`updateCrewAction`/`getCrewForEdit` (`crews/actions.ts`) i `createAuditorAction`/`updateAuditorAction`/`getAuditorForEdit` (`auditors/actions.ts`) — 6 miejsc.

## Zmiana kontraktu
**WYMAGANA.** Bez niej kryteria akceptacji obu wymagań pozostają wewnętrznie sprzeczne z kodem („12 pól" vs 14) i `kk-trace` liczy pokrycie dla nieistniejącego zakresu. Zakres zmiany (rola `contract-steward`, okno kontraktowe):
- `CRM-ZESP-KARTOTEKA.statement` i `CRM-AUDYT-KARTOTEKA.statement`: „komplet 12 pól" → „komplet 14 pól".
- W obu wpisach zaktualizować kryteria mówiące „WSZYSTKIMI 12 polami" (AC-A11) i „wszystkie 12 kolumn" (AC-A13) na 14.
- Dopisać do `acceptance` obu wpisów kryteria AC-E1..AC-E5 z tej erraty.
- W `source` obu wpisów dopisać odwołanie do niniejszej erraty A-2 (2026-08-31) z powodem: pola pominięte przy pierwotnej rejestracji.
- **Zmiana schematu, migracja i macierz uprawnień NIE są potrzebne** — kolumny już istnieją, operacja pozostaje admin-only w niezmienionej macierzy.

## Pola do dodania

| Encja | Kolumna | Nazwa pola w FormData | Kontrolka | Zod | Mapowanie |
|---|---|---|---|---|---|
| `zespoly_monterskie` | `fgaz_valid_until` | `fgazValidUntil` | `<input type="date">` | `z.string().optional()` + regex `^\d{4}-\d{2}-\d{2}$` gdy niepuste | `'' → null`, inaczej `new Date(\`${v}T00:00:00.000Z\`)` |
| `zespoly_monterskie` | `sep_valid_until` | `sepValidUntil` | jw. | jw. | jw. |
| `audytorzy` | `fgaz_valid_until` | `fgaz_valid_until` | jw. | jw. | jw. |
| `audytorzy` | `sep_valid_until` | `sep_valid_until` | jw. | jw. | jw. |

Konwencja nazw pól formularza celowo **naśladuje sąsiada w tym samym pliku**, a nie ujednolica oba modale: `AddCrewModal` używa camelCase (`fgazCert`, `zipCode`), `AddAuditorModal` używa nazw kolumn (`certyfikat_fgaz`). Ujednolicanie nazw pól to osobne zadanie i nie należy tutaj.

**Mapowanie musi trafić do UTC-owej północy.** `@db.Date` jest round-tripowane przez Prismę jako północ UTC danego dnia kalendarzowego, a `isCertValidForDate` porównuje `dateOnlyIso(validUntil)` (UTC) z dniem montażu liczonym w `Europe/Warsaw` — komentarz przy `dateOnlyIsoInWarsaw` (`leads/actions.ts:26-35`) mówi to wprost. `new Date('2027-01-01')` daje północ UTC i jest poprawne; `new Date('2027-01-01T00:00:00')` (bez `Z`) zinterpretuje się w strefie serwera i przy dodatnim offsecie cofnie datę o dzień.

## Układ w UI
- **AddCrewModal.tsx** (dziś linie ok. 246-256): sekcja certyfikatów staje się siatką dwukolumnową. Wiersz 1: „Nr certyfikatu F-GAZ" (istniejący `fgazCert`) | „F-GAZ ważny do" (nowy). Wiersz 2: checkbox „Uprawnienia SEP do 1kV" (istniejący `sep`) | „SEP ważny do" (nowy). Pod sekcją stała nota pomocnicza: „Puste pole = brak ważnego certyfikatu. Zespół bez obu dat nie pojawi się na liście wyboru ekipy przy montażu." — bo to jedyna informacja, która tłumaczy administratorowi, dlaczego świeżo dodana ekipa znika z puli.
- **AddAuditorModal.tsx**: ta sama para wierszy obok istniejących `certyfikat_fgaz` i `uprawnienia_sep`. Nota pomocnicza **inna** i nie może kłamać o blokadzie: „Puste pole = brak udokumentowanej ważności; audytor pozostaje w puli przypisania." Kopiowanie noty od zespołu byłoby fałszem wobec obecnego zachowania `getAuditors()`.
- Pole daty przyjmuje `defaultValue` z `initialData` w formacie `YYYY-MM-DD` (`toISOString().slice(0,10)`); `null` → pusty string.

## Kryteria akceptacji (AC-E)
- [ ] AC-E1: Zespół utworzony przez formularz z wypełnionymi obiema datami ważności (przyszłymi) pojawia się na liście wyboru ekipy dla leada z datą montażu wcześniejszą niż obie daty, i daje się do niego przypisać — bez ręcznego UPDATE w bazie. To jest test na całą ścieżkę: formularz → kolumna → `invalidCrewCerts` → pula.
- [ ] AC-E2: Zespół utworzony z pustymi polami dat NIE pojawia się w puli i próba przypisania go zwraca błąd wymieniający oba certyfikaty („F-Gaz, SEP") — zachowanie `NULL = nieważny` pozostaje niezmienione, errata go dokumentuje, nie odwraca.
- [ ] AC-E3: Otwarcie formularza edycji rekordu z ustawionymi datami pokazuje je w polach, a zapis bez żadnej zmiany zostawia obie kolumny z tą samą wartością co przed (rozszerzenie AC-A13 na nowe pola — to jest test na okrojony `initialData` w `getCrewForEdit`/`getAuditorForEdit`).
- [ ] AC-E4: Wyczyszczenie daty w trybie edycji zapisuje `NULL`, a nie pozostawia poprzedniej wartości i nie zapisuje `Invalid Date` — dotyczy obu encji i obu kolumn.
- [ ] AC-E5: Data wpisana jako `2027-01-01` przy serwerze w strefie `Europe/Warsaw` odczytuje się z bazy jako `2027-01-01` (nie `2026-12-31`) i jest tak samo interpretowana przez `isCertValidForDate`.
- [ ] AC-E6: Audytor utworzony z pustymi datami ważności nadal trafia do puli `getAuditors()` — errata NIE wprowadza dla audytora bramki certyfikatowej. Kryterium jest zabezpieczeniem przed „naprawą dla symetrii".
- [ ] AC-E7: Ustawienie audytorowi `fgaz_valid_until` z formularza zmienia plakietkę na liście `/auditors` (`auditors-client.tsx`) — pole jest realnie konsumowane, nie tylko zapisywane.

## Przypadki brzegowe, które MUSZĄ mieć test
- Pusty string z `FormData` → `null` (nie `new Date('')` = `Invalid Date`, które Prisma odrzuci runtime'owo, ani `new Date(0)` = 1970, co po cichu ustawiłoby certyfikat wygasły 56 lat temu).
- Data w przeszłości: **dozwolona, zapisuje się bez błędu walidacji**. Uzasadnienie: rekord ma dokumentować stan faktyczny, a wygasły certyfikat jest stanem faktycznym; skutek (wypadnięcie z puli) realizuje `invalidCrewCerts`, nie walidator formularza. Dopuszczalne — i zalecane — ostrzeżenie nieblokujące w UI. Zablokowanie zapisu uniemożliwiłoby wprowadzenie zaległych danych i wymusiło obejście przez bazę.
- Data równa dniu montażu: ważny (`>=`), zgodnie z istniejącym testem `crews-cert-availability.test.ts:135-147`. Nowe pole nie może tego przesunąć.
- Data dzień przed montażem: nieważny.
- Jedna data wypełniona, druga pusta: rekord zapisuje się, a komunikat odmowy przypisania wymienia **tylko** brakujący certyfikat.
- Format spoza `YYYY-MM-DD` przesłany z pominięciem kontrolki (Server Action jest publicznym endpointem): odrzucenie po stronie serwera, zero zmienionych kolumn — nie `Invalid Date` w `data`.
- Rok czterocyfrowy poza sensownym zakresem (`0001`, `9999` — `<input type="date">` na to pozwala): decyzja poniżej.
- Rozszerzenie AC-A13 (zapis bez zmian nie gubi nic) musi objąć obie nowe kolumny w obu encjach.

## Poza zakresem
- Dodanie audytorowi filtra certyfikatów w `getAuditors()` lub w akcji przypisania. Nowa reguła biznesowa, brak źródła w dokumentach, wymaga decyzji człowieka i własnego ID.
- Wyświetlanie `sep_valid_until` audytora gdziekolwiek w UI (dziś nie jest czytane; errata dodaje zapis, nie widok).
- Powiadomienie/alert o zbliżającym się wygaśnięciu certyfikatu (kolejka powiadomień, cron) — osobna domena, osobne wymaganie.
- Ujednolicenie konwencji nazw pól `FormData` między oboma modalami.
- Jakakolwiek zmiana `isCertValidForDate`, `invalidCrewCerts` i ich strefowania. Errata karmi istniejący mechanizm danymi, nie przepisuje go.
- Migracja uzupełniająca daty dla rekordów już istniejących w bazie.
- Część B tego WO (przypisanie ekipy poza E4) — nadal odłożona.

## Ryzyka i nieznane
- **Rekordy historyczne.** Nie sprawdzałem, ile zespołów w bazie ma dziś `NULL` w obu kolumnach. Jeżeli jest ich dużo, to znaczy, że pula ekip w E4 jest realnie pusta i użytkownik zgłosił skutek, którego przyczyną jest brak danych, a nie sam brak pola. Uzupełnienie danych jest zadaniem operacyjnym (admin przez formularz po tej poprawce), nie migracją — ale ktoś musi to policzyć przed zamknięciem tematu.
- **Zakres roku.** Czy ograniczać `min`/`max` na kontrolce (np. 1990-2100)? `<input type="date">` bez ograniczeń przepuszcza rok `0001`. Skłaniam się do `max` = dziś + 20 lat i braku `min`, ale to nie wynika z żadnego dokumentu. **WYMAGA DECYZJI: zakres dopuszczalnych lat dla dat ważności certyfikatów (albo świadome „bez ograniczeń").**
- **Ostrzeżenie o dacie przeszłej.** Powyżej zaproponowałem „dozwolone + ostrzeżenie nieblokujące". Żaden dokument tego nie rozstrzyga. Jeżeli człowiek uzna, że data przeszła ma być twardym błędem walidacji, AC-E2 i sekcja przypadków brzegowych wymagają przepisania — dlatego to jest pytanie do rozstrzygnięcia PRZED napisaniem testów, nie po.
- **Kolejność z oknem kontraktowym.** Poprawka `acceptance` dotyczy dwóch wpisów o statusie `TODO`. Jeżeli implementacja pierwotnych `CRM-*-KARTOTEKA` jest w toku, korekta kontraktu w trakcie przebiegu pętli unieważni bieżące pokrycie. Bezpieczniej: domknąć pierwotny zakres, potem errata jako osobny przebieg.
