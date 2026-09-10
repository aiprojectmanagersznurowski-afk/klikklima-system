-- ============================================================================
-- FLD-CALENDAR-FOUNDATION — fundament kalendarza i dostępności (faza 1)
--
-- WYMAGANIA (contracts/requirements.contract.mjs):
--   FLD-AVAIL-WEEKLY-RULES     — reguły cykliczne dostępności
--   FLD-BOOKING-ATOMIC-ASSIGN  — atomowa rezerwacja z natychmiastowym przypisaniem
--   CAL-VISIT-DURATION-BASKETS — słownik koszyków czasu trwania wizyty
--   CAL-TRAVEL-BUFFER          — bufor dojazdu konfigurowalny w panelu B2B
--   CRM-ZESP-AC3               — blokada kalendarza (absences)
--   CRM-BOOK-HISTORY           — historia przekładań (reschedule_of)
--   FNL-E3-E4, B2C-BOOKING-SLOT — nośnik atomowości rezerwacji
--
-- ŹRÓDŁO DECYZJI: docs/architecture/FIELD-APP-PLAN.md rozdz. 6 (6.2 model trzech warstw,
-- 6.4 R1–R6, 6.4a korekta montażu dwuetapowego, 6.4b kod pocztowy/model przydzielania),
-- docs/architecture/CHANGES-ADR-012.md, docs/architecture/database_model.md §3a pkt 10–11,
-- oraz decyzje Michała z 2026-09-09 i korekta z 2026-09-10.
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHOMIONA NA ŻYWEJ BAZIE. Uruchomienie jest osobnym, jawnym krokiem            ║
-- ║  wymagającym zgody człowieka — poza zakresem okna kontraktowego, w którym powstała.   ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Zmiana ADDYTYWNA: cztery nowe tabele, jeden wiersz konfiguracji, zero DROP, zero RENAME,
-- zero ALTER na istniejącej tabeli.
--
-- ── ROZBIEŻNOŚĆ Z ADR-012, ŚWIADOMA (nie przeoczenie) ─────────────────────────────────
-- ADR-012 przewiduje model REGIONOWY przydzielania (`regions` + `region_postal_codes`).
-- Decyzja Michała z 2026-09-10: model PROMIENIOWY (baza pracownika + promień działania).
-- Powody w FIELD-APP-PLAN.md 6.4b. Konsekwencje w tym pliku:
--   * `regions` i `region_postal_codes` NIE POWSTAJĄ i nie powstaną.
--   * Zasób 'regions' ZOSTAJE w RESOURCES/MATRIX (contracts/rbac.contract.mjs) — jego
--     usunięcie jest zmianą łamiącą kompatybilność i wymaga osobnego ADR, nie migracji.
--   * `CRM-REGION-AUTO` przepisane z regionu na promień (to samo ID, dopisana historia).
--
-- ── CZEGO TU NIE MA I DLACZEGO ────────────────────────────────────────────────────────
--   * `audytorzy.promien_dzialania_km` — NIE DODANE. Pojęcie już istnieje w schemacie
--     (baseline.sql:292, pierwotnie pod nazwą `max_promien_dojazdu_km`). Dodanie drugiej
--     kolumny o tym samym znaczeniu utworzyłoby dwa źródła prawdy o promieniu audytora.
--     Ta migracja jedynie DOKUMENTUJE istniejącą kolumnę (sekcja 6), nie tworzy jej.
--
--     KOLEJNOŚĆ URUCHOMIENIA, WAŻNE PRZY CZYTANIU HISTORII: mimo wcześniejszego timestampu
--     ten plik trafia na żywą bazę PO migracji 20260910101000_fld_auditor_radius_rename.sql,
--     która 2026-09-10 przemianowała `audytorzy.max_promien_dojazdu_km` na
--     `audytorzy.promien_dzialania_km`. Rename został uruchomiony pierwszy, ten plik zastaje
--     już NOWĄ nazwę i taką nazwą się posługuje. Wcześniejsza wersja tego nagłówka opisywała
--     asymetrię nazw `audytorzy` / `zespoly_monterskie` jako stan zamrożony (KK-NAMING-BASELINE)
--     — po rename asymetrii nie ma i to uzasadnienie jest nieaktualne. Obie tabele mają dziś
--     kolumnę o identycznej nazwie `promien_dzialania_km`.
--   * `leady.project_number` — osobny plik 20260910100100 (dotyka istniejącej tabeli).
--   * Zmiany w katalogu powiadomień (N8a: `handover_protocol`, `amount`, rozdzielenie
--     `link` na `booking_link` i `payment_link`) — poza zakresem tego okna, osobne okno.
--   * `installation_phases` — nie powstaje tutaj; ADR-012 wiąże je z `bookings` przez
--     `installation_phases.booking_id`, czyli od tamtej strony (patrz nota przy bookings).
-- ============================================================================

-- btree_gist: wymagane, żeby w ograniczeniu wykluczającym postawić obok siebie równość
-- na UUID (btree) i nakładanie się przedziałów czasu (gist). Bez tego rozszerzenia
-- EXCLUDE USING gist (resource_id WITH =, ...) nie da się utworzyć.
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ============================================================================
-- 1. visit_duration_baskets — słownik koszyków czasu trwania wizyty
-- ============================================================================
-- DECYZJA: dedykowana tabela, nie wpis JSONB w `system_config`.
-- Powód: `bookings.visit_basket_id` musi być kluczem obcym. Gdyby koszyk był kluczem
-- w JSON-ie, powiązanie rezerwacji z koszykiem byłoby stringiem dopasowywanym ręcznie —
-- zmiana kodu koszyka po cichu osierociłaby rezerwacje, a baza nie miałaby jak tego
-- zauważyć. Bufor dojazdu (jedna liczba, bez konsumenta referencyjnego) zostaje
-- w `system_config` z dokładnie odwrotnego powodu — patrz sekcja 5.
--
-- Wiersze poniżej to DANE POCZĄTKOWE, nie stałe. Administrator zmienia czasy trwania
-- w panelu B2B (CAL-VISIT-DURATION-BASKETS) i nic w kodzie nie może zakładać, że
-- „audyt to 2 h". To nie są progi SLA: progi SLA są niezmienne z definicji kontraktu,
-- a te wartości są parametrem operacyjnym firmy.
CREATE TABLE IF NOT EXISTS public.visit_duration_baskets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stabilny identyfikator koszyka, po którym odwołuje się do niego kod (np. przy
  -- wstępnym oszacowaniu w Triage). Etykieta PL może się zmieniać, kod nie.
  code              TEXT NOT NULL,

  -- Treść dla użytkownika po polsku (ADR-002: polski wyłącznie w treściach).
  label_pl          TEXT NOT NULL,

  -- Czas trwania w MINUTACH, nie w godzinach: 1,5 h nie jest liczbą całkowitą godzin,
  -- a wartość zmiennoprzecinkowa w harmonogramie to zaproszenie do błędu zaokrąglenia.
  -- „Pół dnia" = 240, „cały dzień" = 480 — to przelicznik firmy, zapisany jako dane.
  duration_minutes  INTEGER NOT NULL,

  -- Która pula obsługuje ten typ wizyty (FIELD-APP-PLAN 6.3: dwie rozłączne pule).
  pool              TEXT NOT NULL,

  -- Wycofanie koszyka ze słownika bez kasowania: rezerwacje historyczne muszą dalej
  -- wskazywać koszyk, którym zostały wycenione. `delete` i tak ma wyłącznie admin (R13).
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  -- Kolejność na liście wyboru audytora. Bez tego kolejność zależy od planu zapytania.
  sort_order        INTEGER NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at        TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT visit_duration_baskets_code_key UNIQUE (code),
  CONSTRAINT visit_duration_baskets_pool_check CHECK (pool IN ('AUDITOR', 'CREW')),
  CONSTRAINT visit_duration_baskets_duration_check CHECK (duration_minutes > 0)
);

-- Dane początkowe wg decyzji Michała (2026-09-09, korekta 2026-09-10).
-- ON CONFLICT DO NOTHING: ponowne uruchomienie pliku NIE nadpisuje wartości zmienionych
-- w panelu B2B. Migracja zakłada słownik, nie resetuje go.
--
-- KOREKTA 2026-09-10 — „montaż duży" (4+ jednostek) NIE MA własnego koszyka.
-- Pierwsza wersja planu (FIELD-APP-PLAN 6.4, tabela) przewidywała „montaż duży = 2 dni",
-- czyli jedną wizytę na dwa następujące po sobie dni. Michal to skorygował: duży montaż
-- realizowany jest ŚCIEŻKĄ DWUETAPOWĄ (etap I cały dzień, etap II pół dnia, przerwa
-- między nimi liczona w tygodniach). Skutek dla silnika: NIE MA przypadku „znajdź dwa
-- sąsiadujące wolne dni u tej samej ekipy". Gdyby koszyk „2 dni" tu powstał, ktoś by go
-- kiedyś użył i ta komplikacja wróciłaby tylnymi drzwiami.
INSERT INTO public.visit_duration_baskets (code, label_pl, duration_minutes, pool, sort_order) VALUES
  ('AUDIT',             'Audyt',                              120, 'AUDITOR', 10),
  ('SERVICE',           'Serwis (przegląd okresowy)',          90, 'CREW',    20),
  ('INCIDENT',          'Usterka (naprawa)',                  120, 'CREW',    30),
  ('INSTALL_SMALL',     'Montaż mały (1 jednostka)',          240, 'CREW',    40),
  ('INSTALL_STANDARD',  'Montaż standardowy (2–3 jednostki)', 480, 'CREW',    50),
  ('INSTALL_PHASE_1',   'Montaż dwuetapowy — etap I',         480, 'CREW',    60),
  ('INSTALL_PHASE_2',   'Montaż dwuetapowy — etap II',        240, 'CREW',    70)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.visit_duration_baskets ENABLE ROW LEVEL SECURITY;
-- Brak polityki = odmowa. Jedynym czytelnikiem jest Prisma (rola `postgres`,
-- rolbypassrls = true) — ten sam wzorzec deny-by-default co w 20260824185845.

COMMENT ON TABLE public.visit_duration_baskets IS
  'Słownik koszyków czasu trwania wizyty (CAL-VISIT-DURATION-BASKETS). Audytor WYBIERA koszyk przy wycenie, nie wpisuje godzin. Wartości są konfigurowalne w panelu B2B — literał czasu trwania w kodzie jest naruszeniem. To NIE są progi SLA.';
COMMENT ON COLUMN public.visit_duration_baskets.duration_minutes IS
  'Minuty. Pół dnia = 240, cały dzień = 480 (przelicznik firmy, zapisany jako dane, nie jako stała).';
COMMENT ON COLUMN public.visit_duration_baskets.pool IS
  'AUDITOR albo CREW — dwie rozłączne pule (FIELD-APP-PLAN 6.3). Musi zgadzać się z tym, kto jest przypisany do rezerwacji: pilnuje tego CHECK bookings_pool_matches_basket.';


-- ============================================================================
-- 2. availability_rules — warstwa 1: reguły cykliczne dostępności
-- ============================================================================
-- Nazwa NIE jest wymyślona: `availability_rules` figuruje wprost w kryterium akceptacji
-- FLD-AVAIL-RESTORE („Gdy powstanie godzinowa dostępność tygodniowa (availability_rules,
-- faza 4)…") oraz w FIELD-APP-PLAN 6.2. Ta migracja realizuje tamtą zapowiedź.
--
-- WŁAŚCICIEL: PRACOWNIK, tak samo jak `availability_declarations`. Osobna tabela, a nie
-- kolumny na `audytorzy`/`zespoly_monterskie` — z tego samego powodu co tam: RBAC i RLS
-- operują na tabelach, nie na kolumnach.
--
-- ROZSTRZYGNIĘCIE — JEDEN PRZEDZIAŁ NA DZIEŃ TYGODNIA (unikalność niżej).
-- Wiele przedziałów obsłużyłoby przerwę w środku dnia, ale nie ma dziś odbiorcy tej
-- funkcji, a kierunek zmiany jest asymetryczny: ZDJĘCIE unikalności później jest
-- rozszerzeniem (żaden istniejący wiersz nie przestaje być legalny), NAŁOŻENIE jej
-- później wymagałoby usuwania danych. Zaczynamy więc od wariantu, z którego da się wyjść.
-- Przerwa jednorazowa ma już reprezentację: wpis w `absences`.
--
-- STREFA CZASOWA (R6, czas letni). `start_time`/`end_time` to TIME BEZ strefy — celowo.
-- Reguła „poniedziałki 8–16" jest w czasie LOKALNYM pracownika (QUEUE_POLICY.timezone =
-- Europe/Warsaw) i ma znaczyć 8–16 również w dniu zmiany czasu. Materializacja reguły na
-- konkretną datę (i zamiana na UTC, w którym zapisane są `bookings`) należy do silnika
-- i musi jawnie użyć strefy — dzień zmiany czasu ma 23 albo 25 godzin.
--
-- BRAK WIERSZY = wartość domyślna z `system_config.scheduling_config`, nie „niedostępny".
-- Inaczej pracownik dodany po tej migracji nigdy nie trafiłby do puli — dokładnie ta sama
-- pułapka, którą `availability_declarations` rozwiązuje regułą „brak wiersza = dostępny".
CREATE TABLE IF NOT EXISTS public.availability_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dokładnie jeden z dwóch jest niepusty (CHECK ..._one_owner niżej) — ten sam wzorzec
  -- co availability_declarations_one_owner (20260821120000) i notification_queue_one_owner.
  auditor_id   UUID REFERENCES public.audytorzy(id) ON DELETE CASCADE,
  crew_id      UUID REFERENCES public.zespoly_monterskie(id) ON DELETE CASCADE,

  -- Klucz „czyja to reguła" sprowadzony do jednej kolumny. Kolumna GENEROWANA, więc nie da
  -- się jej rozjechać z kolumnami źródłowymi. Istnieje po to, żeby unikalność i (w tabeli
  -- bookings) ograniczenie wykluczające miały POJEDYNCZĄ kolumnę do porównania: przy dwóch
  -- kolumnach nullowalnych porównanie NULL = NULL daje NULL, więc ograniczenie milcząco
  -- przepuszczałoby wszystkie wiersze ekip. Kolizja identyfikatorów niemożliwa — to UUID
  -- z dwóch rozłącznych tabel.
  resource_id  UUID GENERATED ALWAYS AS (COALESCE(auditor_id, crew_id)) STORED,

  -- ISO-8601: 1 = poniedziałek … 7 = niedziela. Zgodne z EXTRACT(ISODOW FROM ...),
  -- żeby konwersja w zapytaniu była tożsamościowa, a nie „minus jeden, chyba że niedziela".
  weekday      SMALLINT NOT NULL,

  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,

  -- Wyłączenie reguły bez kasowania wiersza. KONIECZNE, nie kosmetyczne: `delete` na każdym
  -- zasobie ma wyłącznie admin (reguła globalna R13-rbac), więc bez tej flagi pracownik nie
  -- miałby jak zwolnić sobie środy — musiałby prosić administratora o skasowanie wiersza.
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,

  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at   TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT availability_rules_one_owner CHECK (num_nonnulls(auditor_id, crew_id) = 1),
  CONSTRAINT availability_rules_weekday_check CHECK (weekday BETWEEN 1 AND 7),
  -- Przedział pusty albo odwrócony to nie „dzień wolny", tylko dane, których silnik nie
  -- umie zinterpretować. Dzień wolny wyraża się brakiem reguły albo is_active = false.
  CONSTRAINT availability_rules_time_order_check CHECK (end_time > start_time)
);

-- Jeden przedział na (pracownik, dzień tygodnia) — patrz rozstrzygnięcie w nagłówku sekcji.
-- Na resource_id, nie na parze kolumn nullowalnych: NULL-e w indeksie unikalnym są sobie
-- nierówne, więc UNIQUE (auditor_id, weekday) przepuściłby dowolną liczbę wierszy ekip.
CREATE UNIQUE INDEX IF NOT EXISTS availability_rules_resource_weekday_key
  ON public.availability_rules (resource_id, weekday);

-- Indeksy na kolumnach FK (PERF-B2B-AUDIT: Postgres NIE tworzy ich automatycznie), a przy
-- okazji obsługują kaskadę ON DELETE od audytorzy/zespoly_monterskie. Nazwy odpowiadają
-- domyślnym nazwom Prisma dla @@index([auditorId]) / @@index([crewId]) — schemat i baza
-- mają nazywać ten sam obiekt tak samo.
CREATE INDEX IF NOT EXISTS availability_rules_auditor_id_idx ON public.availability_rules (auditor_id);
CREATE INDEX IF NOT EXISTS availability_rules_crew_id_idx    ON public.availability_rules (crew_id);

ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.availability_rules IS
  'Warstwa 1 dostępności (FLD-AVAIL-WEEKLY-RULES, FIELD-APP-PLAN 6.2): reguły cykliczne „poniedziałki 8–16". Właściciel: PRACOWNIK. Brak wierszy = domyślne okno z system_config.scheduling_config, NIE „niedostępny". Przełącznik z FLD-AVAIL-RESTORE (availability_declarations.is_available) tej tabeli NIE modyfikuje — jest przesłonięciem, nie edycją źródła.';
COMMENT ON COLUMN public.availability_rules.weekday IS
  'ISO-8601: 1 = poniedziałek … 7 = niedziela, zgodnie z EXTRACT(ISODOW).';
COMMENT ON COLUMN public.availability_rules.start_time IS
  'Czas LOKALNY (Europe/Warsaw), bez strefy — celowo. „8–16" ma znaczyć 8–16 także w dniu zmiany czasu (R6). Zamiana na UTC należy do silnika i musi jawnie wskazać strefę.';
COMMENT ON COLUMN public.availability_rules.resource_id IS
  'Kolumna GENEROWANA = COALESCE(auditor_id, crew_id). Nośnik unikalności — dwie kolumny nullowalne porównują się przez NULL i milcząco przepuszczają duplikaty.';


-- ============================================================================
-- 3. absences — warstwa 2: wyjątki (urlop, chorobowe, awaria auta)
-- ============================================================================
-- Kształt wg ADR-012 / database_model.md (bookings/absences), z trzema odstępstwami
-- opisanymi przy kolumnach: brak `resource_kind` (wynika z tego, który FK jest niepusty),
-- `created_by` jako TEXT bez klucza obcego, dodane `note`.
CREATE TABLE IF NOT EXISTS public.absences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  auditor_id   UUID REFERENCES public.audytorzy(id) ON DELETE CASCADE,
  crew_id      UUID REFERENCES public.zespoly_monterskie(id) ON DELETE CASCADE,
  resource_id  UUID GENERATED ALWAYS AS (COALESCE(auditor_id, crew_id)) STORED,

  starts_at    TIMESTAMPTZ(6) NOT NULL,
  ends_at      TIMESTAMPTZ(6) NOT NULL,

  -- TEXT + CHECK, nie natywny ENUM — ten sam wybór i to samo uzasadnienie co przy
  -- audit_log.operation i notification_queue.status: słownik powodów będzie rósł
  -- (szkolenie, delegacja), a ALTER TYPE ... ADD VALUE nie działa w jednej transakcji
  -- z resztą migracji, podczas gdy CHECK aktualizuje się jednym ALTER-em.
  reason       TEXT NOT NULL,

  -- Wolny tekst: „awaria auta, warsztat do piątku". Nie zastępuje `reason`.
  note         TEXT,

  -- „Kto wpisał". TEXT z adresem e-mail, bez klucza obcego do AuthorizedUser — ta sama
  -- decyzja co w audit_log.actor_email: usunięcie konta nie może osierocić ani skasować
  -- śladu, kto zablokował komuś kalendarz. ADR-012 przewidywał tu FK; odstępstwo świadome.
  created_by   TEXT,

  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT absences_one_owner CHECK (num_nonnulls(auditor_id, crew_id) = 1),
  CONSTRAINT absences_time_order_check CHECK (ends_at > starts_at),
  CONSTRAINT absences_reason_check CHECK (reason IN (
    'VACATION', 'SICK_LEAVE', 'VEHICLE_FAILURE', 'OTHER'
  ))
);

-- Główne zapytanie silnika: „czy ten pracownik ma blokadę w tym oknie".
CREATE INDEX IF NOT EXISTS absences_resource_window_idx
  ON public.absences (resource_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS absences_auditor_id_idx ON public.absences (auditor_id);
CREATE INDEX IF NOT EXISTS absences_crew_id_idx    ON public.absences (crew_id);

-- ŚWIADOMIE BEZ ograniczenia wykluczającego: dwie nakładające się nieobecności tej samej
-- osoby (urlop, a w jego trakcie zwolnienie) są sytuacją prawdziwą, a nie błędem danych.
-- Suma blokad jest tu sumą mnogościową — nakładanie się niczego nie psuje.

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.absences IS
  'Warstwa 2 dostępności (CRM-ZESP-AC3, ADR-012): datowane wyjątki. Wpis nakładający się na slot usuwa go z widoku klienta; istniejące bookings w oknie absencji są RAPORTOWANE dyspozytorowi, nie kasowane po cichu.';
COMMENT ON COLUMN public.absences.reason IS
  'VACATION | SICK_LEAVE | VEHICLE_FAILURE | OTHER. VEHICLE_FAILURE blokuje ekipę tak samo skutecznie jak urlop (ADR-012).';


-- ============================================================================
-- 4. bookings — warstwa 3: konkretne rezerwacje
-- ============================================================================
-- ROZSTRZYGNIĘCIE — EXCLUDE USING gist, nie UNIQUE (pracownik, start).
--
-- ADR-012 i kryteria akceptacji FNL-E3-E4 / B2C-BOOKING-SLOT mówią „unikalny indeks
-- częściowy na (resource_kind, auditor_id, crew_id, scheduled_start)". Intencją tamtego
-- zapisu jest „gwarancja w bazie, nie sprawdzenie w kodzie" i ta intencja jest tu
-- zachowana. Sam kształt jest jednak ZA SŁABY dla modelu, który powstał później:
-- czas trwania wizyty pochodzi z koszyka i wynosi 90, 120, 240 albo 480 minut, więc
-- terminy NIE leżą na jednej siatce godzin. UNIQUE na godzinie startu przepuściłby
-- montaż całodniowy od 08:00 i audyt od 10:00 u tej samej ekipy — dwa różne starty,
-- jedna fizycznie niemożliwa doba. Ograniczenie wykluczające na tstzrange zabrania
-- NAKŁADANIA SIĘ, a nie tylko identyczności, i zawiera w sobie tamten warunek.
--
-- Przedział domknięty z lewej, otwarty z prawej ('[)'): wizyta 08:00–10:00 i wizyta
-- 10:00–12:00 NIE kolidują. Przy '[]' styk godzinowy byłby fałszywą kolizją.
--
-- Częściowe (WHERE status IN ('RESERVED','CONFIRMED')): rezerwacja zwolniona (RELEASED)
-- i zakończona (COMPLETED) nie może blokować slotu. RELEASED jest wynikiem rollbacku
-- T10–T13 oraz przełożenia terminu (CRM-BOOK-HISTORY) — zwalnia slot bez kasowania śladu.
--
-- CZEGO TO OGRANICZENIE NIE ROBI: nie pilnuje BUFORA DOJAZDU. Bufor jest konfigurowalny
-- w panelu B2B (CAL-TRAVEL-BUFFER), a ograniczenie w bazie nie może czytać konfiguracji.
-- Bufor należy do silnika wyliczania puli i musi być stosowany PRZED wstawieniem wiersza.
-- To jest znana granica tej gwarancji, nie luka do zasłonięcia w komentarzu.
CREATE TABLE IF NOT EXISTS public.bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CZEGO DOTYCZY WIZYTA — dokładnie jedno z trzech (wzorzec NTF-POLY).
  -- Montaż NIE MA tu własnej kolumny i to jest decyzja, nie przeoczenie: rezerwacja
  -- montażu wisi na leadzie (`lead_id`), a ADR-012 wiąże etapy montażu z rezerwacją
  -- od DRUGIEJ strony — `installation_phases.booking_id`. Dodanie tu `installation_id`
  -- utworzyłoby drugą, konkurencyjną drogę tego samego powiązania.
  lead_id          UUID REFERENCES public.leady(id) ON DELETE CASCADE,
  service_id       UUID REFERENCES public.serwisy(id) ON DELETE CASCADE,
  incident_id      UUID REFERENCES public.usterki_incidents(id) ON DELETE CASCADE,

  -- KTO WYKONA — przypisanie natychmiastowe przy rezerwacji (R3, decyzja Michała).
  -- Klient widzi pulę, ale rezerwacja od razu wiąże konkretną osobę. Bez tego unikalność
  -- dotyczyłaby POJEMNOŚCI puli, czyli czegoś, czego nie da się wyrazić ograniczeniem.
  auditor_id       UUID REFERENCES public.audytorzy(id) ON DELETE RESTRICT,
  crew_id          UUID REFERENCES public.zespoly_monterskie(id) ON DELETE RESTRICT,
  resource_id      UUID GENERATED ALWAYS AS (COALESCE(auditor_id, crew_id)) STORED,

  -- ADR-012 przewiduje tę kolumnę i zostaje, mimo że jej wartość wynika z tego, który FK
  -- jest niepusty. Redundancja, która potrafi się rozjechać, jest gorsza niż jej brak —
  -- dlatego CHECK bookings_resource_kind_check wiąże ją z kolumnami źródłowymi na sztywno.
  resource_kind    TEXT NOT NULL,

  -- Typ wizyty ze słownika. RESTRICT, nie SetNull: rezerwacja bez koszyka nie ma jak
  -- odtworzyć, dlaczego trwa akurat tyle. Koszyk wycofuje się flagą is_active.
  visit_basket_id  UUID NOT NULL REFERENCES public.visit_duration_baskets(id) ON DELETE RESTRICT,

  -- UTC, spójnie z resztą schematu. `scheduled_end` jest WYLICZONE z koszyka w chwili
  -- rezerwacji i UTRWALONE — nie liczy się go w locie, bo administrator może zmienić czas
  -- trwania koszyka jutro, a rezerwacja z wczoraj ma pozostać tym, co obiecano klientowi.
  scheduled_start  TIMESTAMPTZ(6) NOT NULL,
  scheduled_end    TIMESTAMPTZ(6) NOT NULL,

  status           TEXT NOT NULL DEFAULT 'RESERVED',

  -- Kto zarezerwował (ADR-012). To NIE to samo co przypisanie wykonawcy.
  booked_by        TEXT NOT NULL DEFAULT 'CLIENT',

  -- Czy wykonawcę wskazał automat, czy nadpisał go dyspozytor (decyzja Michała pkt 3).
  -- Bez tej kolumny „dlaczego akurat ta ekipa" nie ma odpowiedzi po fakcie.
  assignment_mode  TEXT NOT NULL DEFAULT 'AUTO',

  -- CRM-BOOK-HISTORY: przełożenie tworzy NOWY wiersz wskazujący poprzedni, poprzedni
  -- dostaje status RELEASED. Historia jest łańcuchem, nie nadpisaniem.
  reschedule_of    UUID REFERENCES public.bookings(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at       TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT bookings_one_subject CHECK (num_nonnulls(lead_id, service_id, incident_id) = 1),
  CONSTRAINT bookings_one_assignee CHECK (num_nonnulls(auditor_id, crew_id) = 1),

  -- `resource_kind` nie może zaprzeczyć temu, który klucz obcy jest wypełniony.
  CONSTRAINT bookings_resource_kind_check CHECK (
    (resource_kind = 'AUDITOR' AND auditor_id IS NOT NULL) OR
    (resource_kind = 'CREW'    AND crew_id    IS NOT NULL)
  ),

  CONSTRAINT bookings_status_check CHECK (status IN (
    'RESERVED', 'CONFIRMED', 'RELEASED', 'COMPLETED'
  )),
  CONSTRAINT bookings_booked_by_check CHECK (booked_by IN ('CLIENT', 'DISPATCHER')),
  CONSTRAINT bookings_assignment_mode_check CHECK (assignment_mode IN ('AUTO', 'MANUAL')),
  CONSTRAINT bookings_time_order_check CHECK (scheduled_end > scheduled_start),
  -- Rezerwacja nie może być przełożeniem samej siebie. Dłuższych cykli baza nie wykryje —
  -- to zadanie dla akcji tworzącej przełożenie.
  CONSTRAINT bookings_reschedule_not_self CHECK (reschedule_of IS DISTINCT FROM id)
);

-- Pula wizyty musi zgadzać się z pulą koszyka: audyt obsługuje audytor, montaż/serwis/
-- usterkę ekipa (FIELD-APP-PLAN 6.3). Jako trigger, nie CHECK — CHECK nie może odpytać
-- innej tabeli. Bez tego da się zapisać „audyt wykonuje ekipa montażowa", a błąd wyjdzie
-- dopiero na widoku klienta.
CREATE OR REPLACE FUNCTION public.bookings_pool_matches_basket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  basket_pool TEXT;
BEGIN
  SELECT pool INTO basket_pool
    FROM public.visit_duration_baskets
   WHERE id = NEW.visit_basket_id;

  IF basket_pool IS DISTINCT FROM NEW.resource_kind THEN
    RAISE EXCEPTION
      'bookings: koszyk wizyty obsługuje pulę %, a rezerwacja przypisana jest do puli %',
      basket_pool, NEW.resource_kind
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_pool_matches_basket_trg ON public.bookings;
CREATE TRIGGER bookings_pool_matches_basket_trg
  BEFORE INSERT OR UPDATE OF visit_basket_id, resource_kind, auditor_id, crew_id
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_pool_matches_basket();

-- ─────────────────────────────────────────────────────────────────────────────
-- JĄDRO ATOMOWOŚCI (FNL-E3-E4, B2C-BOOKING-SLOT, FLD-BOOKING-ATOMIC-ASSIGN).
-- Dwa równoległe żądania na ten sam slot: dokładnie jedno kończy się sukcesem,
-- drugie dostaje 23P01 (exclusion_violation) i ma je zamienić na błąd domenowy
-- „slot zajęty" wraz z listą alternatyw — nie na odpowiedź 500.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap_per_resource;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap_per_resource
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (status IN ('RESERVED', 'CONFIRMED'));

CREATE INDEX IF NOT EXISTS bookings_lead_id_idx       ON public.bookings (lead_id);
CREATE INDEX IF NOT EXISTS bookings_service_id_idx    ON public.bookings (service_id);
CREATE INDEX IF NOT EXISTS bookings_incident_id_idx   ON public.bookings (incident_id);
CREATE INDEX IF NOT EXISTS bookings_reschedule_of_idx ON public.bookings (reschedule_of);
CREATE INDEX IF NOT EXISTS bookings_auditor_id_idx    ON public.bookings (auditor_id);
CREATE INDEX IF NOT EXISTS bookings_crew_id_idx       ON public.bookings (crew_id);
-- Wzorzec silnika: „czym ten pracownik jest zajęty w tym oknie".
CREATE INDEX IF NOT EXISTS bookings_resource_start_idx
  ON public.bookings (resource_id, scheduled_start);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
-- Brak polityki = odmowa. Rezerwacja przez klienta idzie publicznym linkiem z tokenem
-- przez Server Action opartą na Prisma (rolbypassrls = true), a nie przez supabase-js —
-- polityka dla `anon` bez wskazanego konsumenta byłaby zgadywanką (argument z 20260824185845).

COMMENT ON TABLE public.bookings IS
  'Warstwa 3 dostępności i docelowo JEDYNE źródło prawdy o terminach (ADR-012). leady.data_rezerwacji NIE jest tą migracją usuwane — przeniesienie danych i DROP COLUMN to osobna zmiana, po powstaniu konsumenta.';
COMMENT ON CONSTRAINT bookings_no_overlap_per_resource ON public.bookings IS
  'Atomowość rezerwacji (FNL-E3-E4, B2C-BOOKING-SLOT): brak NAKŁADAJĄCYCH SIĘ rezerwacji tego samego pracownika w statusach RESERVED/CONFIRMED. Silniejsze niż UNIQUE na godzinie startu, bo czasy trwania różnią się między koszykami. Naruszenie: SQLSTATE 23P01.';
COMMENT ON COLUMN public.bookings.scheduled_end IS
  'Wyliczone z visit_duration_baskets.duration_minutes w chwili rezerwacji i UTRWALONE. Zmiana czasu trwania koszyka nie przesuwa rezerwacji już zawartych.';
COMMENT ON COLUMN public.bookings.assignment_mode IS
  'AUTO = wykonawcę wskazał automat przy rezerwacji; MANUAL = nadpisał dyspozytor (przejście T01).';


-- ============================================================================
-- 5. scheduling_config — bufor dojazdu i domyślne okno pracy
-- ============================================================================
-- DECYZJA: wpis w istniejącej `system_config`, nie osobna tabela.
-- Powód, dokładnie odwrotny niż przy koszykach: to są pojedyncze skalary, do których
-- nic się nie odwołuje kluczem obcym. Osobna tabela na jedną liczbę dokłada migrację
-- i zapytanie, nie dokładając ani jednej gwarancji. Wzorzec `fomo_config` istnieje.
--
-- travel_buffer_minutes — bufor dojazdu (R2, decyzja Michała: 1 h, konfigurowalny).
--   Liczony MIĘDZY WIZYTAMI TEJ SAMEJ OSOBY, nie globalnie. Stosuje go silnik przy
--   wyliczaniu puli — patrz nota o granicy ograniczenia wykluczającego w sekcji 4.
-- default_workday_* i default_weekdays — okno używane, gdy pracownik NIE MA ani jednej
--   reguły w `availability_rules`. Istnieje po to, żeby brak reguł znaczył „domyślnie
--   dostępny w godzinach pracy", a nie „niedostępny na zawsze".
INSERT INTO public.system_config (typ_konfiguracji, konfiguracja) VALUES (
  'scheduling_config',
  '{
     "travel_buffer_minutes": 60,
     "default_workday_start": "08:00",
     "default_workday_end": "16:00",
     "default_weekdays": [1, 2, 3, 4, 5]
   }'::jsonb
)
ON CONFLICT (typ_konfiguracji) DO NOTHING;
-- DO NOTHING, nie DO UPDATE: wartość zmieniona przez administratora w panelu B2B jest
-- ważniejsza niż wartość początkowa z tego pliku.


-- ============================================================================
-- 6. Promień działania pracownika — dokumentacja istniejących kolumn
-- ============================================================================
-- Model promieniowy (decyzja Michała, 2026-09-10, zamiast regionowego z ADR-012) czyta
-- z kolumn, które JUŻ ISTNIEJĄ. Ta sekcja niczego nie dodaje i niczego nie zmienia —
-- ustawia wyłącznie komentarze, żeby przy następnym „przecież audytor nie ma promienia"
-- odpowiedź była w bazie, a nie w czyjejś pamięci. Nazwa kolumny promienia jest w obu
-- tabelach TA SAMA (`promien_dzialania_km`) od migracji 20260910101000, uruchomionej na
-- żywej bazie przed tym plikiem — patrz nota o kolejności w nagłówku.
COMMENT ON COLUMN public.audytorzy.promien_dzialania_km IS
  'Promień działania audytora w km (CRM-REGION-AUTO, model promieniowy). Nazwa ujednolicona z zespoly_monterskie.promien_dzialania_km w oknie FLD-AUDITOR-RADIUS-RENAME (2026-09-10) — wcześniej max_promien_dojazdu_km. Jedno pojęcie, jedna nazwa, dwa miejsca odczytu dla silnika przydzielania. NULL = promień nieustalony, co znaczy „brak danych", NIE „0 km" i NIE „nieograniczony".';
COMMENT ON COLUMN public.audytorzy.kod_pocztowy_bazowy IS
  'Kod pocztowy bazy audytora — punkt, od którego liczony jest promień (CRM-REGION-AUTO). Edytowalny przez pracownika w Field App i przez administratora w panelu B2B; każda zmiana idzie do audit_log (FLD-BASE-LOCATION-EDIT).';
COMMENT ON COLUMN public.zespoly_monterskie.promien_dzialania_km IS
  'Promień działania ekipy w km (CRM-REGION-AUTO, model promieniowy). NULL = brak danych, NIE „0 km" — ekipa z promieniem 0 nigdzie nie dojedzie i wypada z filtrów.';
COMMENT ON COLUMN public.zespoly_monterskie.kod_pocztowy_bazowy IS
  'Kod pocztowy bazy ekipy — punkt, od którego liczony jest promień (CRM-REGION-AUTO). Edytowalny w Field App i w panelu B2B, zmiana idzie do audit_log (FLD-BASE-LOCATION-EDIT).';
