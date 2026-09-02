-- ============================================================================
-- PERF-B2B-AUDIT — indeksy na kolumnach kluczy obcych
-- Źródło decyzji: docs/performance/AUDYT-B2B-2026-09-02.md
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UWAGA: TA MIGRACJA NIE ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE.                           ║
-- ║  Napisana 2026-09-02, zacommitowana jako plik, świadomie NIEZAAPLIKOWANA.             ║
-- ║  Uruchomienie wymaga OSOBNEJ, JAWNEJ zgody człowieka.                                 ║
-- ║  Obecność pliku ani zielony `prisma validate` NIE dowodzą, że te indeksy istnieją.    ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  UCZCIWIE: TA MIGRACJA DAJE DZIŚ ZERO.                                                ║
-- ║  Zmierzony stan danych 2026-09-02: 0 klientów, 0 leadów, 1 instalacja.                ║
-- ║  Przy takich tabelach planer i tak wybierze skan sekwencyjny — żaden z poniższych     ║
-- ║  indeksów nie skróci ani jednego zapytania o mierzalną wartość.                       ║
-- ║  To UBEZPIECZENIE NA WZROST DANYCH, nie optymalizacja z dzisiejszym zyskiem.          ║
-- ║  Jeżeli za pół roku ktoś szuka zmiany, która „przyspieszyła panel" — to NIE JEST ta   ║
-- ║  zmiana. Przyspieszenie panelu pochodzi z commita perf(b2b) (dedup roundtripów auth,  ║
-- ║  _count zamiast zagnieżdżonego include): getCustomers 893 → 324 ms.                   ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- Powód istnienia: PostgreSQL tworzy indeks automatycznie dla PRIMARY KEY i UNIQUE,
-- ale NIE dla kolumny będącej kluczem obcym. Zmierzony stan indeksów na żywej bazie:
--   leady:      leady_pkey, leady_status_idx, leady_created_at_idx
--   klienci:    tylko klienci_pkey
--   adresy:     tylko adresy_pkey
--   instalacje: tylko instalacje_pkey
--   serwisy:    tylko serwisy_pkey
--
-- CONCURRENTLY: świadomie NIE użyte. `CREATE INDEX CONCURRENTLY` nie może działać
-- wewnątrz bloku transakcyjnego, a mechanizm uruchamiania migracji w tym repozytorium
-- nie daje gwarancji, że plik nie zostanie owinięty w transakcję. Przy tabelach o tej
-- wielkości (0–1 wiersz) blokada ACCESS EXCLUSIVE trwa milisekundy i jest bez znaczenia.
-- Gdyby tę migrację uruchamiać dopiero na dużych, produkcyjnie obciążonych tabelach —
-- należy najpierw rozbić ją na osobne polecenia CONCURRENTLY poza transakcją.
--
-- Zmiana ADDYTYWNA i IDEMPOTENTNA: wyłącznie CREATE INDEX IF NOT EXISTS.
-- Zero DROP, zero RENAME, zero ALTER na istniejących kolumnach, zero backfillu.
-- Nazwy indeksów są zgodne z domyślną konwencją Prisma (<tabela>_<kolumny>_idx),
-- żeby `prisma migrate diff` nie zgłaszał dryfu po uruchomieniu.
--
-- Uzasadnienie per indeks pochodzi z KODU (Server Actions panelu B2B), nie z domysłu.
-- ============================================================================

-- leady.audytor_id
-- getLeads(): dla roli `audytor` lista jest zawężana przez scopeWhere = { audytor_id }
-- w trzech zapytaniach naraz (findMany + count + groupBy).
-- Dodatkowo audytorzy.delete() wymusza SetNull na tej kolumnie.
CREATE INDEX IF NOT EXISTS leady_audytor_id_idx ON public.leady (audytor_id);

-- leady.klient_id
-- getCustomers(): _count.leady per klient to agregacja po klient_id.
CREATE INDEX IF NOT EXISTS leady_klient_id_idx ON public.leady (klient_id);

-- leady (status, data_rezerwacji ASC, created_at DESC)
-- Dokładny kształt najczęstszego zapytania panelu — getLeads():
--   WHERE status = $1 ORDER BY data_rezerwacji ASC, created_at DESC LIMIT $2 OFFSET $3
-- Prefiks (status, data_rezerwacji) obsługuje także getLogisticsLeads():
--   WHERE status IN (...) ORDER BY data_rezerwacji ASC
-- Kierunki sortowania są jawne, bo sortowanie jest MIESZANE (ASC + DESC) — indeks
-- bez jawnych kierunków nie zostałby użyty do uniknięcia sortowania.
-- Istniejący leady_status_idx staje się redundantnym prefiksem tego indeksu. Jego
-- usunięcie to zmiana odejmująca — NIE robimy jej tutaj, wymaga osobnej decyzji.
CREATE INDEX IF NOT EXISTS leady_status_data_rezerwacji_created_at_idx
  ON public.leady (status, data_rezerwacji ASC, created_at DESC);

-- instalacje.lead_id
-- getLeads(): zagnieżdżony select instalacje ładuje relację przez WHERE lead_id IN (...).
-- assignCrewToLead(): tx.instalacje.findFirst({ where: { lead_id } }).
-- Dodatkowo leady → instalacje ma onDelete: Cascade, co bez indeksu skanuje całą tabelę.
CREATE INDEX IF NOT EXISTS instalacje_lead_id_idx ON public.instalacje (lead_id);

-- instalacje.zespol_id
-- zespoly_monterskie.delete() (crews/actions.ts) wymusza SetNull na tej kolumnie.
CREATE INDEX IF NOT EXISTS instalacje_zespol_id_idx ON public.instalacje (zespol_id);

-- serwisy.instalacja_id — instalacje.delete() (installations/actions.ts) → SetNull.
CREATE INDEX IF NOT EXISTS serwisy_instalacja_id_idx ON public.serwisy (instalacja_id);

-- serwisy.zespol_id — zespoly_monterskie.delete() → SetNull.
CREATE INDEX IF NOT EXISTS serwisy_zespol_id_idx ON public.serwisy (zespol_id);

-- usterki_incidents.instalacja_id — instalacje.delete() → SetNull.
CREATE INDEX IF NOT EXISTS usterki_incidents_instalacja_id_idx
  ON public.usterki_incidents (instalacja_id);

-- usterki_incidents.zespol_id — zespoly_monterskie.delete() → SetNull.
CREATE INDEX IF NOT EXISTS usterki_incidents_zespol_id_idx
  ON public.usterki_incidents (zespol_id);

-- adresy.klient_id
-- anonymizeClient() (RODO) wykonuje adresy.updateMany({ where: { klient_id } })
-- wewnątrz transakcji anonimizacji.
CREATE INDEX IF NOT EXISTS adresy_klient_id_idx ON public.adresy (klient_id);

-- logistyka_zamowienia (lead_id, created_at DESC)
-- Wzorzec „ostatnie zamówienie leada":
--   markAsDelivered(): findFirst({ where: { lead_id }, orderBy: { created_at: 'desc' } })
--   getLogisticsLeads(): include logistyka_zamowienia z orderBy created_at desc, take 1
-- Dodatkowo leady → logistyka_zamowienia ma onDelete: Cascade.
CREATE INDEX IF NOT EXISTS logistyka_zamowienia_lead_id_created_at_idx
  ON public.logistyka_zamowienia (lead_id, created_at DESC);

-- ============================================================================
-- ŚWIADOMIE POMINIĘTE (żeby nie mnożyć indeksów „na wszelki wypadek"):
--   leady.adres_id           — nie istnieje ścieżka usuwania adresu, żadne zapytanie
--                              nie filtruje leadów po adres_id (join idzie po adresy_pkey).
--   serwisy.klient_id/adres_id, usterki_incidents.klient_id
--                            — klient nie jest usuwany (RODO anonimizuje, nie kasuje),
--                              a listy czytają całe tabele i dołączają po kluczu głównym.
--   instalacje.data_planowana, instalacje.next_service_date
--                            — getInstallations() i getUpcomingServices() czytają całą
--                              tabelę bez LIMIT; indeks nie zmienia planu skanu całości.
-- Każdy z tych indeksów kosztowałby zapis przy każdym INSERT/UPDATE, nie dając czytelnika.
-- ============================================================================
