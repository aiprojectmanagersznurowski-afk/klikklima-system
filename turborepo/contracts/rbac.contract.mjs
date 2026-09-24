/**
 * KONTRAKT: Role, uprawnienia i zasady RODO.
 * Źródła: b2b_app_requirements.md (Epic 5), database_model.md (§4), b2b_crm_specifications.md (globalne „Usuń")
 *
 * Zasada nadrzędna: DELETE w każdym widoku CRM = wyłącznie rola `admin`,
 * egzekwowane w TRZECH warstwach (UI, Server Action, RLS). Test kontraktowy sprawdza wszystkie trzy.
 */

export const ROLES = ['admin', 'dyspozytor', 'audytor', 'monter'];

export const RESOURCES = [
  'clients', 'leads', 'quotes', 'installations', 'services', 'incidents',
  'auditors', 'crews', 'shipments', 'notification_queue', 'message_templates', 'authorized_users', 'audit_log',
  // ── ADR-012 (2026-08-18) ──
  'bookings', 'absences', 'regions', 'documents', 'invoices', 'contact_log', 'notes', 'vehicles', 'soft_leads',
  // ── FLD-AVAILABILITY-SPLIT (D-A, 2026-08-21) ──
  // Odpowiada tabeli public.availability_declarations (migracja 20260821120000).
  'availability_declarations',
  // ── FLD-CONSENT-DOCS (D-C, 2026-08-21) ──
  // Odpowiadają tabelom public.legal_document_versions i public.employee_consents
  // (migracja 20260821130000). D-C: NOWY zasób, nie rozszerzenie `documents` — tamten ma
  // `create` przyznane audytorowi i monterowi, więc rozszerzenie zlałoby „tworzę dokument"
  // z „akceptuję dokument" w jednym zasobie, a macierz nie rozróżnia rodzajów w obrębie zasobu.
  'legal_document_versions', 'employee_consents',
  // ── FLD-CALENDAR-FOUNDATION (2026-09-10) ──
  // Odpowiadają tabelom public.availability_rules i public.visit_duration_baskets
  // (migracja 20260910100000). `bookings` i `absences` już są wyżej (ADR-012) — powstały
  // dziś jako tabele, ale jako ZASOBY istniały od 2026-08-18 i nie wymagają wpisu.
  //
  // MODEL PROMIENIOWY (decyzja Michała 2026-09-10) zastąpił regionowy, ale zasób 'regions'
  // ZOSTAJE: jego usunięcie jest zmianą łamiącą kompatybilność i wymaga osobnego ADR.
  // Tabela `regions` nie powstanie — to zasób bez nośnika, świadomie, do czasu tamtej decyzji.
  'availability_rules', 'visit_duration_baskets',
  // ── CAL-SCHEDULING-CONFIG-RBAC (2026-09-15, rozstrzygnięcie P-1 przez Michała) ──
  // Odpowiada tabeli public.system_config (istnieje od dawna, wiersz
  // typ_konfiguracji = 'scheduling_config' zasiedlony migracją 20260910100000).
  // Zasób NIE powstaje z nową tabelą ani migracją — powstaje, bo `can()` dla zasobu
  // spoza tej listy zwraca 'no' dla KAŻDEJ roli, więc bramka w updateTravelBufferAction
  // (CAL-TRAVEL-BUFFER) odmawiałaby zapisu także administratorowi.
  // Odrzucono przepięcie bufora pod `visit_duration_baskets:update`: działałoby, ale
  // zakłamywałoby macierz — nazwy zasobów są tożsame z nazwami tabel (ADR-002), a audyt
  // czytałby „admin edytuje słownik koszyków" tam, gdzie edytuje konfigurację harmonogramu.
  'system_config',
  // ── ETAP 0 FIELD APP / PODPISY / WYCENA (2026-09-23, okno KK-IMPL-2026Q4) ──
  // Odpowiadają tabelom tworzonym migracjami 20260925090000-20260925092000.
  //
  // `quotes`, `documents` i `invoices` są na tej liście OD 2026-08-18 (ADR-012) i były dotąd
  // zasobami BEZ TABEL — teraz dostają nośniki. Nie dopisuję ich ponownie; weryfikacja ich
  // uprawnień wobec nowego schematu jest niżej, przy wierszach MATRIX.
  //
  // CZEGO TU ŚWIADOMIE NIE MA: quote_variants, quote_rooms i quote_items. To są podtabele
  // oferty, a nie osobne byty uprawnieniowe — autoryzacja dzieje się na `quotes` (agregat),
  // bo „prawo do oferty" i „prawo do pozycji tej oferty" to w tym modelu jedno i to samo
  // uprawnienie. Dopisanie ich dałoby trzy wiersze macierzy, które musiałyby być zawsze
  // zgodne z wierszem `quotes`, czyli trzy okazje do rozjazdu bez ani jednej nowej decyzji.
  // Gdyby kiedykolwiek pojawiła się potrzeba innego prawa do pozycji niż do oferty (np. ekipa
  // widzi pozycje, ale nie widzi cen) — to jest moment na osobny zasób, nie wcześniej.
  'price_list_items', 'installation_contracts', 'signatures', 'installation_photos',
  // ── D-API-2 (2026-09-24, okno KK-IMPL-2026Q4) ──
  // Odpowiada tabeli public.security_events (migracja 20260926091000).
  //
  // CZEGO TU ŚWIADOMIE NIE MA: `field_request_idempotency` (D-API-1, migracja 20260926090000).
  // To jest infrastruktura TRANSPORTU, a nie zasób biznesowy — wiersz jest zużytym biletem na
  // powtórzenie żądania, nie danymi, do których ktokolwiek ma albo nie ma prawa. Nikt go nie
  // czyta z panelu, nie ma ekranu, nie ma odczytu przez `can()`. Dopisanie go tutaj wymusiłoby
  // wiersz w MATRIX (R13), czyli zmyśloną odpowiedź na pytanie, którego nikt nie zadaje, i przy
  // okazji zasugerowałoby, że istnieje ścieżka odczytu — a jedynym konsumentem jest INSERT
  // wewnątrz transakcji zapisu. Decyzja wprost potwierdzona w zleceniu.
  'security_events',
];

/** capability: read | create | update | delete | assign */
export const MATRIX = [
  // `read` rozszerzone o 'audytor:own' i 'monter:own' 2026-09-24 (wyjaśnienie Michała do
  // CRM-KLI-AC2): audytor i ekipa montażowa MUSZĄ widzieć dane kontaktowe swojego zlecenia —
  // bez telefonu do klienta nie da się dojechać ani uprzedzić o spóźnieniu — ale nie mogą
  // dostać przy tej okazji dostępu do CRM.
  //
  // CO ZNACZY TU `:own` (to jest nietypowe i dlatego wymaga zapisania): klient NIE MA
  // przypisanego audytora ani ekipy. Przypisanie wisi na LEADZIE i na MONTAŻU. `own` znaczy
  // więc „klient osiągalny przez leada albo montaż przypisany do tego aktora", a nie
  // „klient z kolumną wskazującą na tego aktora" — kolumny takiej nie ma i nie powstaje.
  // To jest ten sam kształt zawężenia co przy `installations.read: monter:own`, tylko o jedno
  // złączenie dalej, i musi go wyrazić funkcja domenowa, bo macierz nie opisuje ścieżek złączeń.
  //
  // CZEGO TO ROZSZERZENIE NIE DAJE: `create`, `update` i `delete` zostają bez zmian przy
  // ['admin', 'dyspozytor'] / ['admin']. Prawo zobaczenia numeru telefonu na swoim zleceniu
  // nie może nieść prawa poprawienia tego numeru — inaczej korekta w terenie rozjeżdżałaby
  // kartotekę klienta bez śladu w CRM. Macierz nie rozróżnia KOLUMN, więc zawężenie odczytu
  // do trzech pól (imię i nazwisko, telefon, adres) NIE jest wyrażone tym wierszem — wyraża
  // je funkcja domenowa i to jest jawnie zapisane w kryteriach CRM-KLI-AC2.
  { resource: 'clients',            read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  // `create` rozszerzone o rolę `audytor` 2026-09-23 (decyzja Michała D14 z 2026-09-21,
  // okno KK-IMPL-2026Q4): audytor zakłada leada w terenie dla klienta, który nie przeszedł
  // przez Triage (FLD-AUDIT-LEAD-CREATE). To jest DRUGIE wejście do lejka i zarazem jedyny
  // powód tej zmiany — dlatego rozszerza się WYŁĄCZNIE `create`. `update` zostaje
  // ['admin', 'dyspozytor'], bo prawo założenia leada nie może nieść prawa edycji cudzych
  // leadów, a `read` zostaje z wariantem :own, bo audytor ma widzieć swoje, nie wszystkie.
  // Bez wariantu :own przy `create`: wiersz w chwili tworzenia nie ma jeszcze właściciela,
  // więc :own nie miałoby czego sprawdzić — przypisanie audytora do leada jest osobnym
  // uprawnieniem (`assign`) i zostaje przy adminie.
  { resource: 'leads',              read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['admin', 'dyspozytor', 'audytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin'] },
  { resource: 'quotes',             read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['audytor', 'admin'],    update: ['audytor:own', 'admin'], delete: ['admin'] },
  { resource: 'installations',      read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'services',           read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'incidents',          read: ['admin', 'dyspozytor', 'monter:own'],       create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor', 'monter:own'], delete: ['admin'] },
  { resource: 'auditors',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'crews',              read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'shipments',          read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'notification_queue', read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'message_templates',  read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'authorized_users',   read: ['admin'],                                   create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'audit_log',          read: ['admin'],                                   create: ['admin'],               update: [],                      delete: [] },
  // ── ADR-012: zasoby dodane 2026-08-18 ──
  // Klient rezerwuje termin przez publiczny link z tokenem, a nie jako rola w RBAC — nie ma konta
  // w authorized_users. Ta ścieżka jest osobnym, wąskim endpointem z własnym guardem, nie wpisem w macierzy.
  { resource: 'bookings',           read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin', 'dyspozytor'] },
  { resource: 'absences',           read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'regions',            read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'documents',          read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'dyspozytor', 'audytor', 'monter'], update: ['admin'], delete: ['admin'] },
  { resource: 'invoices',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'contact_log',        read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: [],                      delete: ['admin'] },
  { resource: 'notes',              read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'vehicles',           read: ['admin', 'dyspozytor'],                     create: ['admin'],               update: ['admin'],               delete: ['admin'] },
  { resource: 'soft_leads',         read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  // ── FLD-AVAILABILITY-SPLIT: zasób dodany 2026-08-21 (decyzja D-A + rozstrzygnięcie R2) ──
  // Jedyny zasób, na którym role terenowe mają `update`. Istnieje po to, żeby to prawo NIE niosło
  // ze sobą prawa zapisu do audytorzy.is_active i audytorzy.leave_status: macierz nie rozróżnia
  // kolumn, więc rozdzielenie musi przebiegać po granicy tabeli.
  //
  // `auditors.update` i `crews.update` powyżej zostają ['admin'] — TO JEST SEDNO tego wiersza.
  // Dopisanie tam 'audytor:own' skasowałoby cały sens zmiany: pracownik odzyskałby ścieżkę
  // do zdjęcia sobie blokady administracyjnej i urlopu wpisanego przez kadry.
  //
  // `create` z wariantem :own jest konieczne, nie ozdobne: pracownik dodany po migracji nie ma
  // jeszcze wiersza deklaracji (backfill objął wyłącznie stan z dnia wdrożenia), więc pierwsza
  // zmiana dostępności jest wstawieniem, a nie aktualizacją.
  // `delete` wyłącznie admin (R13) — pracownik nie kasuje własnej deklaracji, tylko ją przełącza;
  // usunięcie wiersza znaczy „dostępny", więc byłoby drugą, cichą ścieżką do tego samego skutku.
  { resource: 'availability_declarations', read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'audytor:own', 'monter:own'], update: ['admin', 'audytor:own', 'monter:own'], delete: ['admin'] },
  // ── FLD-CONSENT-DOCS: zasoby dodane 2026-08-21 (decyzje D-C i D-D) ──
  //
  // legal_document_versions — treść zgód RODO i regulaminu, wersjonowana.
  // `read` bez wariantu :own i dla wszystkich ról: dokument prawny nie jest „czyjś". Pracownik
  // MUSI przeczytać treść, żeby ją zaakceptować, a akceptacja treści, do której nie ma dostępu,
  // byłaby bezwartościowa dowodowo — czyli byłaby zaprzeczeniem powodu, dla którego ten rejestr istnieje.
  // `create`/`update`/`delete` wyłącznie admin (AC7): wgranie i opublikowanie wersji to czynność
  // administratora, sprawdzana po stronie serwera. Ukrycie przycisku w UI nie jest zabezpieczeniem,
  // bo Prisma omija RLS (pułapka 1 w CLAUDE.md).
  // `update` dla admina istnieje, bo publikacja i wycofanie wersji TO JEST update kolumny is_current.
  // Niezmienności treści opublikowanej NIE pilnuje ten wiersz — macierz nie rozróżnia kolumn —
  // tylko wyzwalacz legal_document_versions_freeze_published_trg w bazie (AC1).
  { resource: 'legal_document_versions', read: ['admin', 'dyspozytor', 'audytor', 'monter'], create: ['admin'], update: ['admin'], delete: ['admin'] },
  //
  // employee_consents — rejestr akceptacji. APPEND-ONLY, profil audit_log.
  // `update: []` i `delete: []` — NIKT, łącznie z adminem. To jest świadoma decyzja, a nie skutek
  // złapania przez regułę: mutacja R22-audit-append-only w kk-selftest.mjs jest przypięta do
  // literalnego wiersza `audit_log`, więc TEGO zasobu by nie złapała. Powód jest ten sam co tam:
  // rejestr, który administrator może poprawić, nie jest dowodem niczego, a poprawiony wpis zgody
  // to dowód wobec organu wystawiony po fakcie. Zmiana zdania = nowy wiersz (nowa akceptacja),
  // nigdy edycja starego. W bazie odpowiada temu wyzwalacz employee_consents_append_only_trg (AC5).
  // `delete: []` przechodzi R13 (reguła dopuszcza pustą listę, jak przy audit_log). Retencja RODO
  // (AUDIT_REQUIREMENTS.retentionDays) to purge operacyjny po upływie okresu, a nie uprawnienie roli.
  // `create` dla ról terenowych bez wariantu :own — wariant :own zapisałby „pracownik akceptuje
  // własną zgodę", ale właściciela wiersza wyznacza tu dopiero para (auditor_id | crew_id), której
  // macierz nie widzi; ograniczenie „tylko za siebie" musi wyrazić polityka RLS i Server Action.
  // `admin` w `create` jest celowo NIEOBECNY: administrator nie akceptuje zgody w imieniu pracownika.
  // To jedyny wiersz w tej macierzy, w którym admina nie ma w `create`, i to jest sedno — akceptacja
  // wpisana przez kogoś innego niż pracownik nie jest akceptacją.
  { resource: 'employee_consents', read: ['admin', 'audytor:own', 'monter:own'], create: ['audytor', 'monter'], update: [], delete: [] },
  // ── FLD-CALENDAR-FOUNDATION: zasoby dodane 2026-09-10 ──
  //
  // availability_rules — reguły cykliczne dostępności („poniedziałki 8–16"). Profil ten sam
  // co availability_declarations i z tego samego powodu: to dane WŁASNE pracownika, a nie dane
  // kadrowe o nim. Prawo zapisu do własnego grafiku nie może nieść prawa zapisu do is_active
  // ani leave_status — dlatego to osobna tabela i osobny wiersz, a `auditors.update` / `crews.update`
  // zostają ['admin'].
  // `create` z wariantem :own jest konieczne, nie ozdobne: pracownik nie ma żadnej reguły do czasu,
  // aż pierwszy raz ustawi grafik, więc pierwsza zmiana jest wstawieniem, a nie aktualizacją.
  // `delete` wyłącznie admin (R13) — i dlatego tabela MUSI mieć is_active. Bez tej flagi „zwolnij
  // mi środy" byłoby operacją, do której pracownik nie ma prawa, czyli funkcją niewykonalną
  // dla jej właściciela. To ten sam układ co przy deklaracji: przełączamy, nie kasujemy.
  { resource: 'availability_rules', read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['admin', 'audytor:own', 'monter:own'], update: ['admin', 'audytor:own', 'monter:own'], delete: ['admin'] },
  //
  // visit_duration_baskets — słownik koszyków czasu trwania wizyty.
  // `read` bez wariantu :own i dla ról terenowych: audytor WYBIERA koszyk przy wycenie, więc musi
  // widzieć cały słownik. Koszyk nie jest „czyjś".
  // `create`/`update` wyłącznie admin: czas trwania wizyty jest parametrem operacyjnym firmy,
  // ustawianym w panelu B2B. Gdyby audytor mógł edytować słownik, „wybór z koszyka" zamieniłby się
  // z powrotem we wpisywanie godzin z palca — czyli w to, co ta konstrukcja miała wykluczyć.
  { resource: 'visit_duration_baskets', read: ['admin', 'dyspozytor', 'audytor', 'monter'], create: ['admin'], update: ['admin'], delete: ['admin'] },
  // ── CAL-SCHEDULING-CONFIG-RBAC: zasób dodany 2026-09-15 (P-1, decyzja Michała) ──
  //
  // system_config — parametry operacyjne firmy w JSONB, dziś wiersz `scheduling_config`
  // (travel_buffer_minutes + default_workday_start/end + default_weekdays).
  // `read`/`update` wyłącznie admin: to ekran administracyjny, a role terenowe konsumują
  // te wartości WYŁĄCZNIE pośrednio, przez silnik terminów (packages/scheduling), który
  // czyta konfigurację po stronie serwera i nie pyta macierzy o zgodę w imieniu pracownika.
  // Dlatego brak tu wariantu :own i brak dyspozytora — zmiana bufora przesuwa terminy
  // obiecywane wszystkim klientom, więc nie jest czynnością operacyjną dyspozytora.
  //
  // `create: []` i `delete: []` — świadomie, nie z przeoczenia. Kolumna typ_konfiguracji jest
  // @unique, a wiersz `scheduling_config` powstaje migracją; UI ma go wyłącznie EDYTOWAĆ.
  // Puste `create` znaczy „konfiguracja nie jest zakładana z panelu", puste `delete` znaczy
  // „nie ma ścieżki skasowania konfiguracji" — usunięcie wiersza nie zerowałoby bufora, tylko
  // wywróciłoby silnik, który jest fail-closed (brak wartości => error, nie fallback do 0).
  // Rozszerzenie o create/delete to osobna decyzja i osobne okno, nie domyślne dopełnienie wzorca.
  { resource: 'system_config',      read: ['admin'],                                   create: [],                      update: ['admin'],               delete: [] },
  // ── ETAP 0 FIELD APP / PODPISY / WYCENA: wiersze dodane 2026-09-23 ──
  //
  // price_list_items — cennik kosztorysowy (PRICE-LIST-SCHEMA, PRICE-LIST-ADMIN).
  // `read` dla audytora bez wariantu :own: cennik nie jest „czyjś", a audytor musi widzieć
  // wszystkie pozycje, żeby złożyć z nich wycenę. Monter cennika nie potrzebuje — nie wycenia.
  // `create`/`update` wyłącznie admin (D15: cennik prowadzi administrator, nie programista
  // i nie audytor w terenie; gdyby audytor mógł zmieniać ceny, „wycena z cennika" zamieniłaby
  // się z powrotem we wpisywanie kwot z palca).
  // `delete: []` — NIKT, łącznie z adminem, i to jest decyzja, nie przeoczenie: usunięcie
  // pozycji rozspójnia oferty historyczne, które się na nią powołują (FLD-QUOTE-PRICE-SNAPSHOT
  // wymaga, żeby oferta sprzed miesiąca dała się odtworzyć). Wycofanie pozycji z użytku to
  // przełączenie flagi aktywności, nie skasowanie wiersza — ten sam układ co przy
  // availability_rules, gdzie „usuń" też zastąpiono przełącznikiem. R13 dopuszcza pustą listę.
  { resource: 'price_list_items',   read: ['admin', 'dyspozytor', 'audytor'],          create: ['admin'],               update: ['admin'],               delete: [] },
  //
  // installation_contracts — umowa montażu (FLD-CONTRACT-GENERATE).
  // `create` dla audytora: umowę generuje się z oferty na miejscu u klienta.
  // `update` z wariantem :own dla audytora — dotyczy WYŁĄCZNIE szkicu przed wysłaniem.
  // Niezmienności umowy PODPISANEJ nie pilnuje ten wiersz (macierz nie rozróżnia stanów wiersza),
  // tylko wyzwalacz w bazie — dokładnie tak samo, jak przy legal_document_versions niezmienności
  // treści opublikowanej pilnuje legal_document_versions_freeze_published_trg, a nie macierz.
  { resource: 'installation_contracts', read: ['admin', 'dyspozytor', 'audytor:own'],  create: ['admin', 'dyspozytor', 'audytor'], update: ['admin', 'audytor:own'], delete: ['admin'] },
  //
  // signatures — podpisy klienta wraz ze śladem dowodowym (FLD-SIGN-AUDIT-TRAIL).
  // APPEND-ONLY, profil audit_log i employee_consents: `update: []` i `delete: []` — NIKT,
  // łącznie z administratorem. Powód jest ten sam i wart powtórzenia: podpis, który
  // administrator może poprawić, nie jest dowodem niczego, a poprawiony ślad to dowód wobec
  // sądu wytworzony po fakcie. Unieważnienie podpisu = nowy wiersz opisujący unieważnienie,
  // nigdy edycja starego. W bazie odpowiada temu wyzwalacz signatures_append_only_trg.
  // UWAGA (ta sama klasa wyjątku co przy rezerwacji terminu przez klienta w ADR-012):
  // KLIENT podpisujący zdalnie NIE MA konta w authorized_users i nie jest rolą w tej macierzy.
  // Ta ścieżka jest osobnym, wąskim endpointem chronionym jednorazowym tokenem o wysokiej
  // entropii (FLD-SIGN-REMOTE) i własnym limitem prób (FLD-SIGN-ABUSE-GUARD), a nie wpisem tutaj.
  // `create` dla ról terenowych bez wariantu :own — właściciela wiersza wyznacza dopiero
  // wskazanie dokumentu, którego macierz nie widzi; ograniczenie „tylko do swojego zlecenia"
  // wyraża funkcja domenowa, tak samo jak przy employee_consents.
  { resource: 'signatures',         read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['audytor', 'monter'], update: [],            delete: [] },
  //
  // installation_photos — dokumentacja zdjęciowa montażu i audytu (FLD-PHOTO-SET, FLD-PHOTO-STORAGE).
  // `create` dla montera (zdjęcia montażowe) i audytora (zdjęcia z audytu, FLD-AUDIT-FORM).
  // `update: []` — zdjęcie jest dowodem wykonania pracy i podstawą wypłaty dla ekipy
  // (KPI OPS-06), więc podmiana pliku pod istniejącym wierszem nie może być operacją dostępną
  // komukolwiek; pomyłka naprawia się nowym zdjęciem, nie nadpisaniem starego.
  // `delete` wyłącznie admin — zgodnie z globalną zasadą „usuwa wyłącznie admin".
  { resource: 'installation_photos', read: ['admin', 'dyspozytor', 'audytor:own', 'monter:own'], create: ['audytor', 'monter'], update: [],           delete: ['admin'] },
  //
  // ── D-API-2: security_events — dziennik odmów dostępu (2026-09-24) ──
  //
  // DLACZEGO OSOBNA TABELA, A NIE audit_log (decyzja Michała, uzasadnienie powtórzone
  // w komentarzu migracji, bo to jest pytanie, które wróci): `audit_log` odpowiada na pytanie
  // „co się działo z danymi TEJ OSOBY" i cały jego kształt z tego wynika — `record_id NOT NULL`
  // (musi wskazywać rekord), `justification` o długości ≥ 10 znaków (człowiek tłumaczy, czemu
  // to zrobił) i `legal_basis` ze słownika RODO. Odmowa dostępu nie ma rekordu, którego
  // dotyczy (bywa, że właśnie dlatego jest odmową), nie ma uzasadnienia od człowieka i nie ma
  // podstawy prawnej — wpisanie jej tam wymagałoby ATRAP w trzech kolumnach naraz, a atrapa
  // w rejestrze dowodowym psuje ten rejestr dla jego własnego zastosowania.
  // Drugi, niezależny powód: PROFIL RUCHU. `audit_log` to pojedyncze wpisy przy operacjach
  // wrażliwych; odmowy potrafią przyjść seriami przy skanowaniu. Wspólna tabela znaczy, że
  // skan zasypuje dowody RODO i psuje retencję 1825 dni policzoną dla zupełnie innego wolumenu.
  // Dlatego `access_denied` NIE zostało dopisane do AUDIT_REQUIREMENTS.mustLog.
  //
  // APPEND-ONLY, profil audit_log / employee_consents / signatures: `update: []`, `delete: []` —
  // NIKT, łącznie z administratorem. Powód ten sam i wart powtórzenia po raz czwarty: dziennik
  // odmów, który administrator może poprawić, nie jest dowodem niczego, a to właśnie konto
  // administratora jest najciekawszym kontem dla kogoś, kto te odmowy generuje.
  //
  // `read: ['admin']` — jak przy audit_log. Dyspozytora tu NIE MA świadomie: dziennik odmów
  // jest narzędziem bezpieczeństwa, nie narzędziem operacyjnym, a lista „kto czego próbował"
  // jest sama w sobie mapą tego, co warto spróbować.
  // `create: ['admin']` jest formalnością wymuszoną przez R22-owy kształt wiersza append-only
  // i NIE opisuje faktycznego producenta: wiersze wstawia warstwa autoryzacji po stronie
  // serwera przy odmowie, a nie administrator z panelu.
  //
  // GRANICA, KTÓRĄ TRZEBA ZNAĆ (kryterium SEC-ACCESS-DENIED-LOG): logujemy odmowy aktora
  // UWIERZYTELNIONEGO. Ruch anonimowy NIE tworzy wierszy — inaczej dziennik odmów sam staje
  // się wektorem zapełnienia dysku, czyli zamienia się w podatność, którą miał wykrywać.
  { resource: 'security_events',    read: ['admin'],                                   create: ['admin'],               update: [],                      delete: [] },
];

/**
 * AKTOR SYSTEMOWY — zapisy wykonywane bez udziału człowieka (rozstrzygnięcie Michała 2026-09-23).
 *
 * Problem: faktura zaliczkowa ma się wystawiać AUTOMATYCZNIE po zaksięgowaniu wpłaty (D9 krok 2),
 * czyli w wywołaniu zwrotnym dostawcy płatności, gdzie nie ma zalogowanego człowieka. Michał
 * rozstrzygnął, że taki zapis ma przechodzić przez TĘ SAMĄ bramkę `can()` co zapis ręczny,
 * a nie obok niej — bo ścieżka omijająca autoryzację jest ścieżką, której nikt nie audytuje.
 *
 * DLACZEGO TO NIE JEST PIĄTA WARTOŚĆ W `ROLES` (decyzja projektowa contract-steward, 2026-09-23):
 * `ROLES` nie jest listą „bytów, które mogą coś zrobić" — jest DZIEDZINĄ KOLUMNY
 * `authorized_users.role`, chronioną w bazie ograniczeniem CHECK (migracja
 * 20260907173000_security_authorized_user_role_no_default.sql) i dlatego jako jedyne miejsce
 * w kontrakcie trzyma wartości po polsku (ADR-002, wyjątek świadomy). Dopisanie tam `SYSTEM`
 * oznaczałoby, że wartość `SYSTEM` wolno zapisać w kolumnie roli KONTA — czyli że da się
 * założyć użytkownika z uprawnieniami automatu i zalogować się jako on. To jest podniesienie
 * uprawnień wprowadzone tylnymi drzwiami przy okazji faktury i dlatego odrzucone.
 * Odrzucony został też wariant odwrotny (wyjątek systemowy poza `can()`) — wprost przez Michała.
 *
 * Wybrany wariant: WĄSKA, ODDZIELNA LISTA NADAŃ. Aktor systemowy nie jest rolą, nie ma konta
 * i nie ma wiersza w MATRIX; ma wyłącznie wymienione niżej pary (zasób, uprawnienie).
 * Precedens dla samego pojęcia istnieje w kontrakcie od dawna: `ACTORS` w
 * contracts/funnel.contract.mjs zawiera `SYSTEM` obok CLIENT/DISPATCHER/ADMIN/AUDITOR/INSTALLER,
 * bo przejścia wyzwalane cronem i webhookiem też nie mają człowieka. Tu jest to samo pojęcie,
 * przeniesione na warstwę uprawnień.
 *
 * JAK USTALANA JEST TOŻSAMOŚĆ AKTORA (to jest najważniejsza część i dlatego jest w kontrakcie,
 * nie w kodzie): aktor systemowy NIGDY nie pochodzi z treści żądania. Nie z nagłówka, nie
 * z parametru, nie z pola w JSON-ie — każde z tych źródeł kontroluje ten, kto wysyła żądanie,
 * więc każde z nich zamieniłoby tę listę w publiczny cennik uprawnień do wzięcia. Ustala go
 * WYŁĄCZNIE serwer, po pomyślnej weryfikacji podpisu kryptograficznego dostawcy płatności
 * (sekret po stronie serwera, liczony z surowego ciała żądania). Kolejność jest wiążąca:
 * najpierw weryfikacja podpisu, dopiero potem nadanie aktora i wywołanie `can()`. Żądanie
 * z niepoprawnym podpisem nie dociera do `can()` w ogóle.
 *
 * Zakres nadań jest celowo minimalny: `create` na `invoices` i nic więcej. Brak `read` — automat
 * nie czyta cudzych danych; brak `update` i `delete` — automat nie poprawia ani nie kasuje
 * dokumentów księgowych. Rozszerzenie tej listy to zmiana kontraktu, okno i osobna decyzja.
 */
export const SYSTEM_ACTOR = 'system';

export const SYSTEM_GRANTS = [
  {
    resource: 'invoices',
    capabilities: ['create'],
    trigger: 'payment_provider_webhook',
    rationale: 'Faktura zaliczkowa wystawiana automatycznie po zaksięgowaniu wpłaty (D9 krok 2). Idempotencja po identyfikatorze zdarzenia płatności jest warunkiem koniecznym — ponowiony webhook nie może wystawić drugiego dokumentu (ryzyko R15).',
    req: ['INV-ADVANCE-AUTO'],
    status: 'STABLE',
  },
];

/** Polityki kluczy obcych przy usuwaniu — database_model.md §4.2 */
export const DELETE_POLICIES = [
  { entity: 'clients',   strategy: 'ANONYMIZE_OR_SET_NULL', rationale: 'RODO bez utraty historii finansowej montażu.', cascades: [] },
  { entity: 'leads',     strategy: 'CASCADE',               rationale: 'Duplikat/błąd systemowy — encje zależne w trakcie tworzenia idą w kaskadzie.', cascades: ['quotes', 'shipments'] },
  { entity: 'auditors',  strategy: 'BLOCK_UNTIL_REASSIGNED', rationale: 'Wymusza przepięcie wiszących leadów.', cascades: [] },
  { entity: 'crews',     strategy: 'BLOCK_UNTIL_REASSIGNED', rationale: 'Wymusza przepięcie aktywnych instalacji.', cascades: [] },
];

/**
 * Wymogi audytowe (ADR-008, rozstrzygnięte 2026-08-18).
 * Tabela audit_log jest append-only — RLS odrzuca UPDATE i DELETE dla wszystkich ról,
 * łącznie z admin. Rejestr, który administrator może poprawić, nie jest dowodem niczego.
 */
export const AUDIT_REQUIREMENTS = {
  appendOnly: true,
  // `field_update` (dodane 2026-09-10, okno AUDIT-LOG-FIELD-UPDATE-OP, decyzja Michała):
  // operacja ogólna dla edycji pojedynczych pól rekordu, gdzie audyt jest warunkiem dopuszczenia
  // edycji, a nie następstwem incydentu. Celowo NIE nazywa się `radius_update` ani
  // `base_location_update` — pierwszym konsumentem jest FLD-BASE-LOCATION-EDIT
  // (kod_pocztowy_bazowy / promien_dzialania_km w auditors i crews), ale wartość jest
  // przeznaczona do wielokrotnego użytku. Wartość osobna od `manual_status_change`, bo tamta
  // dotyczy WYŁĄCZNIE przejść maszyny stanów lejka, nie dowolnych pól.
  // W odróżnieniu od pozostałych sześciu wartości: przy `field_update` uzasadnienie NIE pochodzi
  // od użytkownika — wylicza je serwer z wartości przed/po, a legal_basis jest stałą 'OTHER'
  // (ten sam wariant, co bypassLogisticsOrder). Szczegóły w acceptance FLD-BASE-LOCATION-EDIT.
  mustLog: ['delete', 'anonymize', 'role_change', 'contract_override', 'manual_status_change', 'notification_resend', 'field_update'],
  legalBases: ['RODO_ERASURE_REQUEST', 'OPERATIONAL_ERROR', 'DUPLICATE', 'COURT_ORDER', 'OTHER'],
  requiresJustification: true,
  retentionDays: 1825,
  status: 'STABLE',
};
