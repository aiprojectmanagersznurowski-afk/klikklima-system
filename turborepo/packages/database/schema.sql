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

-- 4. Tabela: Urządzenia (Katalog klimatyzatorów)
CREATE TABLE urzadzenia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kod_towaru TEXT UNIQUE, -- np. 'ASYG09KETA', 'AS35S2SF1FA'
    producent TEXT NOT NULL, -- np. 'Fuji Electric', 'Haier'
    linia TEXT NOT NULL, -- np. 'KETA', 'Flexis'
    typ TEXT NOT NULL, -- 'wew_single', 'wew_multi', 'zew_multi'
    moc_chlodnicza_kw NUMERIC NOT NULL,
    max_powierzchnia_m2 INTEGER, -- określa max zasięg urządzenia, np. 35
    ilosc_portow INTEGER, -- tylko dla 'zew_multi' (np. 2, 3, 4, 5)
    cena_katalogowa_netto NUMERIC NOT NULL,
    obrazek_url TEXT,
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
('Montaż jednostki wew i zew do 4m', 'kpl', 1600.00, 1000.00),
('Rozprowadzenie inst chłodniczej', 'mb', 90.00, 50.00),
('Korytko instalacyjne', 'mb', 30.00, 13.00),
('Odpływ skroplin', 'mb', 15.00, 4.00),
('Przewód zasilający', 'mb', 15.00, 4.50),
('Wpięcie zasilania do gniazda na wtyczkę', 'szt', 60.00, 5.50);

INSERT INTO urzadzenia (kod_towaru, producent, linia, typ, moc_chlodnicza_kw, max_powierzchnia_m2, ilosc_portow, cena_katalogowa_netto) VALUES
('ASYG07KETA', 'Fuji Electric', 'KETA', 'wew_single', 2.0, 25, NULL, 3000.00),
('ASYG09KETA', 'Fuji Electric', 'KETA', 'wew_single', 2.5, 35, NULL, 3200.00),
('ASYG12KETA', 'Fuji Electric', 'KETA', 'wew_single', 3.5, 50, NULL, 3500.00),
('AS25S2SF1FA', 'Haier', 'Flexis Plus', 'wew_single', 2.5, 25, NULL, 2800.00),
('AS35S2SF1FA', 'Haier', 'Flexis Plus', 'wew_single', 3.5, 35, NULL, 3100.00),
('ASYG07KMTA', 'Fuji Electric', 'KMTA', 'wew_multi', 2.0, 25, NULL, 1500.00),
('ASYG09KMTA', 'Fuji Electric', 'KMTA', 'wew_multi', 2.5, 35, NULL, 1600.00),
('ASYG12KMTA', 'Fuji Electric', 'KMTA', 'wew_multi', 3.5, 50, NULL, 1800.00),
('AOYG14KBTA2', 'Fuji Electric', 'Multi Zewnętrzna', 'zew_multi', 4.0, NULL, 2, 4500.00),
('AOYG18KBTA2', 'Fuji Electric', 'Multi Zewnętrzna', 'zew_multi', 5.4, NULL, 2, 5200.00),
('AOYG24KBTA3', 'Fuji Electric', 'Multi Zewnętrzna', 'zew_multi', 6.8, NULL, 3, 6500.00),
('AOYG30KBTA4', 'Fuji Electric', 'Multi Zewnętrzna', 'zew_multi', 8.0, NULL, 4, 8000.00);


-- 8. Tabela: Soft Leady (Numery telefonów przed zakończeniem pełnego kalkulatora)
CREATE TABLE IF NOT EXISTS soft_leady (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dane_kontaktowe TEXT NOT NULL,
    dane_cząstkowe JSONB,
    status TEXT DEFAULT 'Nowy',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE soft_leady ENABLE ROW LEVEL SECURITY;
