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
];

/** capability: read | create | update | delete | assign */
export const MATRIX = [
  { resource: 'clients',            read: ['admin', 'dyspozytor'],                     create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'] },
  { resource: 'leads',              read: ['admin', 'dyspozytor', 'audytor:own'],      create: ['admin', 'dyspozytor'], update: ['admin', 'dyspozytor'], delete: ['admin'], assign: ['admin'] },
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
