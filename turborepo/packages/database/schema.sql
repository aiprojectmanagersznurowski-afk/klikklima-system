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

-- 4. Tabela: Leady (Zlecenia, Triage, Exit-Intent)
CREATE TABLE leady (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id UUID REFERENCES klienci(id) ON DELETE SET NULL,
    adres_id UUID REFERENCES adresy(id) ON DELETE SET NULL,
    odpowiedzi_triage JSONB, -- Zapis kalkulatora pokoi lub porzuconego koszyka
    estymowana_wycena TEXT,
    status status_leada_enum DEFAULT 'Nowy',
    -- audytor_id korzysta z tabeli auth.users zarządzanej przez Supabase Auth
    audytor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    data_rezerwacji TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
