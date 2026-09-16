-- ============================================================================
-- CRM-READABLE-IDENTIFIERS — czytelne identyfikatory biznesowe dla głównych encji
-- WYMAGANIE: CRM-READABLE-IDENTIFIERS (contracts/requirements.contract.mjs)
-- Źródło decyzji: decyzja Michała 2026-09-12 (Wariant 1: krótkie prefiksy + 6 cyfr)
--
-- ╔══════════════════════════════════════════════════════════════════════════════════════╗
-- ║  NIE URUCHOMIONA NA ŻYWEJ BAZIE. Osobny, jawny krok za zgodą człowieka.               ║
-- ╚══════════════════════════════════════════════════════════════════════════════════════╝
--
-- CZEGO TA MIGRACJA NIE ROBI: nie rusza kluczy głównych (id UUID) ani kluczy obcych.
-- Identyfikatory są numerami DLA LUDZI (CRM, telefon, faktury, montażyści).
--
-- FORMAT: '[PREFIKS]-' || sześć cyfr z wiodącymi zerami:
--   * K-XXXXXX   — Klienci (klienci.client_number)
--   * I-XXXXXX   — Instalacje (instalacje.installation_number)
--   * S-XXXXXX   — Serwisy (serwisy.service_number)
--   * U-XXXXXX   — Usterki (usterki_incidents.incident_number)
--   * A-XXXXXX   — Adresy (adresy.address_number)
--   * E-XXXXXX   — Ekipy monterskie (zespoly_monterskie.crew_number)
--   * AU-XXXXXX  — Audytorzy (audytorzy.auditor_number)
--   * P-XXXXXX   — Logistyka/Przesyłki (logistyka_zamowienia.shipment_number)
--   * B-XXXXXX   — Rezerwacje (bookings.booking_number)
--   (Leady mają już L-XXXXXX w public.leady.project_number)
-- ============================================================================

-- 1. KLIENCI: client_number (K-000123)
CREATE SEQUENCE IF NOT EXISTS public.clients_client_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.klienci
  ADD COLUMN IF NOT EXISTS client_number TEXT
  DEFAULT ('K-' || lpad(nextval('public.clients_client_number_seq')::text, 6, '0'));

UPDATE public.klienci
   SET client_number = 'K-' || lpad(nextval('public.clients_client_number_seq')::text, 6, '0')
 WHERE client_number IS NULL;

ALTER TABLE public.klienci
  ALTER COLUMN client_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'klienci_client_number_key') THEN
    ALTER TABLE public.klienci ADD CONSTRAINT klienci_client_number_key UNIQUE (client_number);
  END IF;
END $$;

ALTER SEQUENCE public.clients_client_number_seq OWNED BY public.klienci.client_number;

-- 2. INSTALACJE: installation_number (I-000123)
CREATE SEQUENCE IF NOT EXISTS public.installations_installation_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.instalacje
  ADD COLUMN IF NOT EXISTS installation_number TEXT
  DEFAULT ('I-' || lpad(nextval('public.installations_installation_number_seq')::text, 6, '0'));

UPDATE public.instalacje
   SET installation_number = 'I-' || lpad(nextval('public.installations_installation_number_seq')::text, 6, '0')
 WHERE installation_number IS NULL;

ALTER TABLE public.instalacje
  ALTER COLUMN installation_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instalacje_installation_number_key') THEN
    ALTER TABLE public.instalacje ADD CONSTRAINT instalacje_installation_number_key UNIQUE (installation_number);
  END IF;
END $$;

ALTER SEQUENCE public.installations_installation_number_seq OWNED BY public.instalacje.installation_number;

-- 3. SERWISY: service_number (S-000123)
CREATE SEQUENCE IF NOT EXISTS public.services_service_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.serwisy
  ADD COLUMN IF NOT EXISTS service_number TEXT
  DEFAULT ('S-' || lpad(nextval('public.services_service_number_seq')::text, 6, '0'));

UPDATE public.serwisy
   SET service_number = 'S-' || lpad(nextval('public.services_service_number_seq')::text, 6, '0')
 WHERE service_number IS NULL;

ALTER TABLE public.serwisy
  ALTER COLUMN service_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'serwisy_service_number_key') THEN
    ALTER TABLE public.serwisy ADD CONSTRAINT serwisy_service_number_key UNIQUE (service_number);
  END IF;
END $$;

ALTER SEQUENCE public.services_service_number_seq OWNED BY public.serwisy.service_number;

-- 4. USTERKI: incident_number (U-000123)
CREATE SEQUENCE IF NOT EXISTS public.incidents_incident_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.usterki_incidents
  ADD COLUMN IF NOT EXISTS incident_number TEXT
  DEFAULT ('U-' || lpad(nextval('public.incidents_incident_number_seq')::text, 6, '0'));

UPDATE public.usterki_incidents
   SET incident_number = 'U-' || lpad(nextval('public.incidents_incident_number_seq')::text, 6, '0')
 WHERE incident_number IS NULL;

-- Kompatybilność wsteczna z numer_zgloszenia: jeśli puste, uzupełnij z incident_number
UPDATE public.usterki_incidents
   SET numer_zgloszenia = incident_number
 WHERE numer_zgloszenia IS NULL;

ALTER TABLE public.usterki_incidents
  ALTER COLUMN incident_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usterki_incidents_incident_number_key') THEN
    ALTER TABLE public.usterki_incidents ADD CONSTRAINT usterki_incidents_incident_number_key UNIQUE (incident_number);
  END IF;
END $$;

ALTER SEQUENCE public.incidents_incident_number_seq OWNED BY public.usterki_incidents.incident_number;

-- 5. ADRESY: address_number (A-000123)
CREATE SEQUENCE IF NOT EXISTS public.addresses_address_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.adresy
  ADD COLUMN IF NOT EXISTS address_number TEXT
  DEFAULT ('A-' || lpad(nextval('public.addresses_address_number_seq')::text, 6, '0'));

UPDATE public.adresy
   SET address_number = 'A-' || lpad(nextval('public.addresses_address_number_seq')::text, 6, '0')
 WHERE address_number IS NULL;

ALTER TABLE public.adresy
  ALTER COLUMN address_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adresy_address_number_key') THEN
    ALTER TABLE public.adresy ADD CONSTRAINT adresy_address_number_key UNIQUE (address_number);
  END IF;
END $$;

ALTER SEQUENCE public.addresses_address_number_seq OWNED BY public.adresy.address_number;

-- 6. ZESPOŁY MONTERSKIE: crew_number (E-000012)
CREATE SEQUENCE IF NOT EXISTS public.crews_crew_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.zespoly_monterskie
  ADD COLUMN IF NOT EXISTS crew_number TEXT
  DEFAULT ('E-' || lpad(nextval('public.crews_crew_number_seq')::text, 6, '0'));

UPDATE public.zespoly_monterskie
   SET crew_number = 'E-' || lpad(nextval('public.crews_crew_number_seq')::text, 6, '0')
 WHERE crew_number IS NULL;

ALTER TABLE public.zespoly_monterskie
  ALTER COLUMN crew_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zespoly_monterskie_crew_number_key') THEN
    ALTER TABLE public.zespoly_monterskie ADD CONSTRAINT zespoly_monterskie_crew_number_key UNIQUE (crew_number);
  END IF;
END $$;

ALTER SEQUENCE public.crews_crew_number_seq OWNED BY public.zespoly_monterskie.crew_number;

-- 7. AUDYTORZY: auditor_number (AU-000015)
CREATE SEQUENCE IF NOT EXISTS public.auditors_auditor_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.audytorzy
  ADD COLUMN IF NOT EXISTS auditor_number TEXT
  DEFAULT ('AU-' || lpad(nextval('public.auditors_auditor_number_seq')::text, 6, '0'));

UPDATE public.audytorzy
   SET auditor_number = 'AU-' || lpad(nextval('public.auditors_auditor_number_seq')::text, 6, '0')
 WHERE auditor_number IS NULL;

ALTER TABLE public.audytorzy
  ALTER COLUMN auditor_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audytorzy_auditor_number_key') THEN
    ALTER TABLE public.audytorzy ADD CONSTRAINT audytorzy_auditor_number_key UNIQUE (auditor_number);
  END IF;
END $$;

ALTER SEQUENCE public.auditors_auditor_number_seq OWNED BY public.audytorzy.auditor_number;

-- 8. WYSYŁKI: shipment_number (P-000123)
CREATE SEQUENCE IF NOT EXISTS public.shipments_shipment_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.logistyka_zamowienia
  ADD COLUMN IF NOT EXISTS shipment_number TEXT
  DEFAULT ('P-' || lpad(nextval('public.shipments_shipment_number_seq')::text, 6, '0'));

UPDATE public.logistyka_zamowienia
   SET shipment_number = 'P-' || lpad(nextval('public.shipments_shipment_number_seq')::text, 6, '0')
 WHERE shipment_number IS NULL;

ALTER TABLE public.logistyka_zamowienia
  ALTER COLUMN shipment_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'logistyka_zamowienia_shipment_number_key') THEN
    ALTER TABLE public.logistyka_zamowienia ADD CONSTRAINT logistyka_zamowienia_shipment_number_key UNIQUE (shipment_number);
  END IF;
END $$;

ALTER SEQUENCE public.shipments_shipment_number_seq OWNED BY public.logistyka_zamowienia.shipment_number;

-- 9. REZERWACJE: booking_number (B-000123)
CREATE SEQUENCE IF NOT EXISTS public.bookings_booking_number_seq AS BIGINT START WITH 1;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_number TEXT
  DEFAULT ('B-' || lpad(nextval('public.bookings_booking_number_seq')::text, 6, '0'));

UPDATE public.bookings
   SET booking_number = 'B-' || lpad(nextval('public.bookings_booking_number_seq')::text, 6, '0')
 WHERE booking_number IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN booking_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_booking_number_key') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_booking_number_key UNIQUE (booking_number);
  END IF;
END $$;

ALTER SEQUENCE public.bookings_booking_number_seq OWNED BY public.bookings.booking_number;
