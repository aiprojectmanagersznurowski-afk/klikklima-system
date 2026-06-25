-- Schemat bazy danych dla systemu Klik Klima (Faza 1)
-- Uwaga: Wklej poniższy kod w edytorze SQL w panelu Supabase.

-- 1. Tworzenie niestandardowego typu ENUM dla statusu leada
CREATE TYPE status_leada_enum AS ENUM (
  'Nowy', 
  'Weryfikacja', 
  'Umówiony Audyt', 
  'Zrealizowane', 
  'Soft Lead', 
  'Utracony'
);

-- 2. Tabela: Klienci (Centralny punkt kontaktowy)
CREATE TABLE klienci (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imie_i_nazwisko TEXT,
    email TEXT,
    telefon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela: Adresy (Jeden klient może mieć wiele lokalizacji montażu)
CREATE TABLE adresy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id UUID NOT NULL REFERENCES klienci(id) ON DELETE CASCADE,
    ulica_miasto TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4a. Tabela: Jednostki Wewnętrzne (Indoor Units)
CREATE TABLE indoor_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_code TEXT NOT NULL UNIQUE,
    series_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    is_single_compatible BOOLEAN DEFAULT false,
    is_multi_compatible BOOLEAN DEFAULT false,
    cooling_capacity_kw NUMERIC,
    heating_capacity_kw NUMERIC,
    power_consumption_cooling_kw NUMERIC,
    power_consumption_heating_kw NUMERIC,
    dimensions TEXT,
    noise_level_min_db INTEGER,
    has_wifi BOOLEAN DEFAULT false,
    has_presence_sensor BOOLEAN DEFAULT false,
    is_silent_mode BOOLEAN DEFAULT false,
    features JSONB,
    price_netto NUMERIC,
    image_url TEXT,
    marketing_description TEXT,
    color TEXT DEFAULT 'Biały',
    recommended_area_m2 INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4b. Tabela: Jednostki Zewnętrzne / Agregaty (Outdoor Units)
CREATE TABLE outdoor_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_code TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    type TEXT NOT NULL, -- 'SINGLE' | 'MULTI'
    max_indoor_units INTEGER DEFAULT 1,
    cooling_capacity_kw NUMERIC,
    heating_capacity_kw NUMERIC,
    max_total_indoor_capacity_kw NUMERIC,
    dimensions TEXT,
    price_netto NUMERIC,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4c. Tabela: Zestawy Single-Split (Gotowe Komplety)
CREATE TABLE single_split_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indoor_unit_id UUID NOT NULL REFERENCES indoor_units(id) ON DELETE CASCADE,
    outdoor_unit_id UUID NOT NULL REFERENCES outdoor_units(id) ON DELETE CASCADE,
    seer NUMERIC,
    scop NUMERIC,
    energy_class_cooling TEXT,
    energy_class_heating TEXT,
    set_price_netto NUMERIC,
    is_bestseller BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(indoor_unit_id, outdoor_unit_id)
);

-- 4d. Tabela: Zestawy Multi-Split (Predefiniowane warianty B2C)
CREATE TABLE multi_split_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    outdoor_unit_id UUID NOT NULL REFERENCES outdoor_units(id) ON DELETE CASCADE,
    indoor_units_json JSONB NOT NULL, -- [{ "indoorUnitId": "uuid", "count": 1 }]
    supported_rooms_count INTEGER,
    set_price_netto NUMERIC,
    is_bestseller BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela: Cennik Usług (Wzorcowy Montaż)
CREATE TABLE cennik_uslug (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nazwa_uslugi TEXT NOT NULL UNIQUE,
    jm TEXT NOT NULL, -- Jednostka Miary: szt, mb, m
    koszt_b2c_netto NUMERIC NOT NULL, -- Cena dla klienta końcowego netto
    koszt_b2b_netto NUMERIC, -- Koszt wewnętrzny dla instalatora netto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela: Leady (Zlecenia, Triage, Exit-Intent)
CREATE TABLE leady (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id UUID REFERENCES klienci(id) ON DELETE SET NULL,
    adres_id UUID REFERENCES adresy(id) ON DELETE SET NULL,
    odpowiedzi_triage JSONB, -- Zapis kalkulatora pokoi
    wybrana_konfiguracja JSONB, -- Konfiguracja urządzeń, cennik montażu
    estymowana_wycena TEXT, -- Wycena pokazana w UI
    status status_leada_enum DEFAULT 'Nowy',
    audytor_id UUID, -- TODO: docelowo powiązanie z auth.users
    data_rezerwacji TIMESTAMP WITH TIME ZONE,
    finalna_wycena_pln NUMERIC, -- Kwota ustalona PO audycie
    przewidywany_czas_montazu TEXT, -- Np. "1 dzień roboczy", uzupełniane przez audytora
    notatki_wewnetrzne TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela: System Config (Parametryzacja Bookingu i Opóźnień)
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    typ_konfiguracji TEXT NOT NULL UNIQUE,
    konfiguracja JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Domena uprawnień: Włączenie Row Level Security (RLS)
ALTER TABLE klienci ENABLE ROW LEVEL SECURITY;
ALTER TABLE adresy ENABLE ROW LEVEL SECURITY;
ALTER TABLE leady ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- UWAGA: Aby Twoje aplikacje mogły odczytywać dane, musisz skonfigurować polisy (Policies) 
-- dla powyższych tabel w panelu Supabase Auth -> Policies, w zależności od potrzeb logiki B2C i B2B.

-- 7. Przykładowe Dane Startowe (Słowniki)
INSERT INTO cennik_uslug (nazwa_uslugi, jm, koszt_b2c_netto, koszt_b2b_netto) VALUES
('Montaż wzorcowy', 'kpl', 1600.00, 1000.00),
('Rozprowadzenie inst chłodniczej', 'mb', 90.00, 50.00),
('Korytko instalacyjne', 'mb', 30.00, 13.00),
('Odpływ skroplin', 'mb', 15.00, 4.00),
('Przewód zasilający', 'mb', 15.00, 4.50),
('Wpięcie zasilania do gniazda na wtyczkę', 'szt', 60.00, 5.50);

-- Usunięto stare dane testowe urządzeń. 
-- Nowe dane urządzeń zostaną zaimportowane za pomocą skryptu migracyjnego.


-- 8. Tabela: Soft Leady (Numery telefonów przed zakończeniem pełnego kalkulatora)
CREATE TABLE IF NOT EXISTS soft_leady (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dane_kontaktowe TEXT NOT NULL,
    dane_cząstkowe JSONB,
    status TEXT DEFAULT 'Nowy',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE soft_leady ENABLE ROW LEVEL SECURITY;

-- 9. Domyślne wartości konfiguracji systemu
INSERT INTO system_config (typ_konfiguracji, konfiguracja) VALUES
('fomo_config', '{"weekly_audit_limit": 10}'::jsonb)
ON CONFLICT (typ_konfiguracji) DO NOTHING;

-- 10. Bezpieczna funkcja RPC (zwracająca wolne terminy do UI publicznego)
CREATE OR REPLACE FUNCTION get_fomo_available_slots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit integer := 10;
  v_booked integer := 0;
  v_start_of_week timestamp with time zone;
BEGIN
  SELECT (konfiguracja->>'weekly_audit_limit')::integer
  INTO v_limit
  FROM system_config
  WHERE typ_konfiguracji = 'fomo_config';

  IF v_limit IS NULL THEN
    v_limit := 10;
  END IF;

  v_start_of_week := date_trunc('week', now());

  SELECT count(*)
  INTO v_booked
  FROM leady
  WHERE status = 'Umówiony Audyt'
  AND data_rezerwacji >= v_start_of_week;

  IF v_limit - v_booked < 1 THEN
    RETURN 1;
  ELSE
    RETURN v_limit - v_booked;
  END IF;
END;
$$;
