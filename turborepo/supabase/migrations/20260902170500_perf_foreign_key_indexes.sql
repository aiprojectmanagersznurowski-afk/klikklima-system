-- ============================================================================
-- PERF-B2B-AUDIT — indeksy na kolumnach kluczy obcych
-- Źródło decyzji: docs/performance/AUDYT-B2B-2026-09-02.md
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  STATUS: TA MIGRACJA ZOSTAŁA URUCHOMIONA NA ŻYWEJ BAZIE i ZWERYFIKOWANA.             ║
-- ║  Napisana 2026-09-02, uruchomiona na żywej bazie — wszystkie 11 indeksów ISTNIEJE.   ║
-- ║                                                                                      ║
-- ║  DOWÓD (nie „plik jest w repo" i nie „prisma validate jest zielony" — odczyt z bazy  ║
-- ║  wykonany 2026-09-03): pg_indexes, schemaname = 'public', zwraca wszystkie 11 nazw   ║
-- ║  wymienionych w tym pliku, co do jednej:                                             ║
-- ║    leady_audytor_id_idx, leady_klient_id_idx,                                        ║
-- ║    leady_status_data_rezerwacji_created_at_idx, instalacje_lead_id_idx,              ║
-- ║    instalacje_zespol_id_idx, serwisy_instalacja_id_idx, serwisy_zespol_id_idx,       ║
-- ║    usterki_incidents_instalacja_id_idx, usterki_incidents_zespol_id_idx,             ║
-- ║    adresy_klient_id_idx, logistyka_zamowienia_lead_id_created_at_idx.                ║
-- ║                                                                                      ║
-- ║  Ewidencja migracji w tym projekcie pozostaje niewiarygodna (wpisy w tabeli          ║
-- ║  supabase_migrations.schema_migrations nie pokrywają liczby plików), więc jedynym    ║
-- ║  źródłem prawdy o schemacie są nadal pg_indexes / pg_constraint, nie ten nagłówek.   ║
-- ║  Ten nagłówek jest ZAPISEM ODCZYTU Z 2026-09-03, nie gwarancją na zawsze.            ║
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
-- DOPISEK 2026-09-03 (nie zmieniam ramki wyżej — została taka, jaka była 2026-09-02).
-- Ramka wyżej jest prawdziwa WYŁĄCZNIE dla stanu danych z 2026-09-02. Przy tym samym
-- odczycie z bazy, który potwierdził istnienie indeksów, policzone zostały wiersze:
--   klienci = 8027, leady = 8015, adresy = 8008, instalacje = 1, serwisy = 0,
--   logistyka_zamowienia = 0.
-- Zdanie „TA MIGRACJA DAJE DZIŚ ZERO" NIE opisuje już dnia dzisiejszego: przy ~8 tys.
-- wierszy w leady, klienci i adresy planer może realnie sięgnąć po indeksy na
-- audytor_id, klient_id i (status, data_rezerwacji, created_at).
-- Świadomie NIE przepisuję tu wniosku wydajnościowego, bo nie mam pomiaru: skąd wzięło
-- się te ~8 tys. wierszy (import, seed, test obciążeniowy?) i czy zostaną w bazie —
-- to pytanie do człowieka. Dopóki nie ma nowego pomiaru EXPLAIN ANALYZE, jedyne, co
-- ten dopisek stwierdza, to że STARE UZASADNIENIE OPIERA SIĘ NA NIEAKTUALNYCH LICZBACH.
-- Nadal obowiązuje natomiast druga część ramki: przyspieszenie panelu z commita
-- perf(b2b) (893 → 324 ms) pochodzi z dedupu roundtripów auth, NIE z tych indeksów.
--
-- Powód istnienia: PostgreSQL tworzy indeks automatycznie dla PRIMARY KEY i UNIQUE,
-- ale NIE dla kolumny będącej kluczem obcym. Stan indeksów zmierzony 2026-09-02, PRZED
-- uruchomieniem tego pliku (zachowany jako uzasadnienie — NIE jest to opis stanu dzisiejszego,
-- dziś indeksy z tego pliku już istnieją, patrz ramka STATUS wyżej):
--   leady:      leady_pkey, leady_status_idx, leady_created_at_idx
--   klienci:    tylko klienci_pkey
--   adresy:     tylko adresy_pkey
--   instalacje: tylko instalacje_pkey
--   serwisy:    tylko serwisy_pkey
--
-- CONCURRENTLY: świadomie NIE użyte. `CREATE INDEX CONCURRENTLY` nie może działać
-- wewnątrz bloku transakcyjnego, a mechanizm uruchamiania migracji w tym repozytorium
-- nie daje gwarancji, że plik nie zostanie owinięty w transakcję. W MOMENCIE URUCHOMIENIA
-- tabele miały 0–1 wiersz, więc blokada ACCESS EXCLUSIVE trwała milisekundy i była bez
-- znaczenia (o dzisiejszych liczbach wierszy — patrz DOPISEK 2026-09-03 wyżej).
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
