-- Wygenerowany skrypt migracyjny dla danych Fuji Electric (Single & Multi)

-- 0. Dodaj kolumne features jesli nie istnieje i Wyczyść starą bazę
ALTER TABLE public.indoor_units ADD COLUMN IF NOT EXISTS features JSONB;
DELETE FROM public.single_split_sets;
DELETE FROM public.multi_split_sets;
DELETE FROM public.indoor_units WHERE brand IN ('Fuji Electric', 'GENERAL');
DELETE FROM public.outdoor_units WHERE brand IN ('Fuji Electric', 'GENERAL');

-- 1. Insert Indoor Units
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH05KJCAL', 'KJCAL', 'GENERAL', 1.5, false, true, 1700, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH07KJCAL', 'KJCAL', 'GENERAL', 2, true, true, 1800, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH09KJCAL', 'KJCAL', 'GENERAL', 2.5, true, true, 1900, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH12KJCAL', 'KJCAL', 'GENERAL', 3.4, true, true, 2100, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH14KJCAL', 'KJCAL', 'GENERAL', 4.2, true, true, 3200, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH05KJCAL-B', 'KJCAL-B', 'GENERAL', 1.5, false, true, 1900, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH07KJCAL-B', 'KJCAL-B', 'GENERAL', 2, true, true, 1990, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH09KJCAL-B', 'KJCAL-B', 'GENERAL', 2.5, true, true, 2100, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH12KJCAL-B', 'KJCAL-B', 'GENERAL', 3.4, true, true, 2300, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('ASHH14KJCAL-B', 'KJCAL-B', 'GENERAL', 4.2, true, true, 3400, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG07KETF', 'KETF White', 'Fuji Electric', 2, true, true, 2120, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG09KETF', 'KETF White', 'Fuji Electric', 2.5, true, true, 2220, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG12KETF', 'KETF White', 'Fuji Electric', 3.4, true, true, 2540, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG14KETF', 'KETF White', 'Fuji Electric', 4.2, true, true, 3560, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG07KETF-B', 'KETF-B Graphite', 'Fuji Electric', 2, true, true, 2120, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG09KETF-B', 'KETF-B Graphite', 'Fuji Electric', 2.5, true, true, 2220, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG12KETF-B', 'KETF-B Graphite', 'Fuji Electric', 3.4, true, true, 2540, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG14KETF-B', 'KETF-B Graphite', 'Fuji Electric', 4.2, true, true, 3560, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH07KGTG', 'KGTG', 'Fuji Electric', 2, true, true, 2280, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Czujnik obecności","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH09KGTG', 'KGTG', 'Fuji Electric', 2.5, true, true, 2390, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Czujnik obecności","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH12KGTG', 'KGTG', 'Fuji Electric', 3.4, true, true, 2590, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Czujnik obecności","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH14KGTG', 'KGTG', 'Fuji Electric', 4.2, true, true, 3630, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Czujnik obecności","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Funkcja 10°C Heat","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH07KMCG', 'KMCG', 'Fuji Electric', 2, true, true, 1550, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH09KMCG', 'KMCG', 'Fuji Electric', 2.5, true, true, 1900, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH12KMCG', 'KMCG', 'Fuji Electric', 3.4, true, true, 2100, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH14KMCG', 'KMCG', 'Fuji Electric', 4.2, true, true, 2800, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH07KMCG-B', 'KMCG-B', 'Fuji Electric', 2, true, true, 1950, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH09KMCG-B', 'KMCG-B', 'Fuji Electric', 2.5, true, true, 2300, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH12KMCG-B', 'KMCG-B', 'Fuji Electric', 3.4, true, true, 2500, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH14KMCG-B', 'KMCG-B', 'Fuji Electric', 4.2, true, true, 3200, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","GOOD DESIGN","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG09KMCEN', 'KMCEN NORDIC', 'Fuji Electric', 2.5, true, false, 2240, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Wskaźnik LED czyszczenia filtra","Filtr jonowy o wydłużonej żywotności","Elektrostatyczny filtr polifenolowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG12KMCEN', 'KMCEN NORDIC', 'Fuji Electric', 3.4, true, false, 2660, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Wskaźnik LED czyszczenia filtra","Filtr jonowy o wydłużonej żywotności","Elektrostatyczny filtr polifenolowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG14KMCEN', 'KMCEN NORDIC', 'Fuji Electric', 4.2, true, false, 3620, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Wskaźnik LED czyszczenia filtra","Filtr jonowy o wydłużonej żywotności","Elektrostatyczny filtr polifenolowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG09KMCEN-B', 'KMCEN-B Black NORDIC', 'Fuji Electric', 2.5, true, false, 2640, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Wskaźnik LED czyszczenia filtra","Filtr jonowy o wydłużonej żywotności","Elektrostatyczny filtr polifenolowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG12KMCEN-B', 'KMCEN-B Black NORDIC', 'Fuji Electric', 3.4, true, false, 3060, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Wskaźnik LED czyszczenia filtra","Filtr jonowy o wydłużonej żywotności","Elektrostatyczny filtr polifenolowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG14KMCEN-B', 'KMCEN-B Black NORDIC', 'Fuji Electric', 4.2, true, false, 4020, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Wskaźnik LED czyszczenia filtra","Filtr jonowy o wydłużonej żywotności","Elektrostatyczny filtr polifenolowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG18KMTE', 'KMTE', 'Fuji Electric', 5.2, true, true, 3730, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe i poziome","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG24KMTE', 'KMTE', 'Fuji Electric', 7.1, true, true, 4470, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe i poziome","Program nocny","Programator dobowy","Programator tygodniowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG30KMTA', 'KMTA', 'Fuji Electric', 8, true, false, 6070, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG36KMTA', 'KMTA', 'Fuji Electric', 9.4, true, false, 6600, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Bardzo cicha praca","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia","Funkcja 10°C Heat","Program nocny","Programator dobowy"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH05KNCA', 'KNCA', 'Fuji Electric', 1.5, false, true, 1300, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH07KNCA', 'KNCA', 'Fuji Electric', 2, true, true, 1500, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH09KNCA', 'KNCA', 'Fuji Electric', 2.5, true, true, 1600, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH12KNCA', 'KNCA', 'Fuji Electric', 3.4, true, true, 1750, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH07KLTA', 'KLTA', 'Fuji Electric', 2, true, false, 1200, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH09KLTA', 'KLTA', 'Fuji Electric', 2.5, true, false, 1400, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSH12KLTA', 'KLTA', 'Fuji Electric', 3.4, true, false, 1700, '["AIRSTAGE - aplikacja do sterowania Wi-Fi","Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG18KLCA', 'KLCA', 'Fuji Electric', 5.2, true, false, 2880, '["Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;
INSERT INTO public.indoor_units (model_code, series_name, brand, cooling_capacity_kw, is_single_compatible, is_multi_compatible, price_netto, features)
VALUES ('RSG24KLCA', 'KLCA', 'Fuji Electric', 7.1, true, false, 3830, '["Zmywalny panel obudowy","Tryb ekonomiczny","Tryb pełnej mocy","Autom. zmiana trybu pracy","Autom. regulacja siły nawiewu","Autom. żaluzje pionowe","Auto Restart","Powrót ustawień po zaniku napięcia"]'::jsonb)
ON CONFLICT (model_code) DO UPDATE SET 
    is_single_compatible = EXCLUDED.is_single_compatible,
    is_multi_compatible = EXCLUDED.is_multi_compatible,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    price_netto = EXCLUDED.price_netto,
    features = EXCLUDED.features;

-- 2. Insert Outdoor Units
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHH07KJCA', 'GENERAL', 'SINGLE', 2, 1, 2700)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHH09KJCA', 'GENERAL', 'SINGLE', 2.5, 1, 3000)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHH12KJCA', 'GENERAL', 'SINGLE', 3.4, 1, 3400)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHH14KJCA', 'GENERAL', 'SINGLE', 4.2, 1, 4100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG07KETA', 'Fuji Electric', 'SINGLE', 2, 1, 2450)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG09KETA', 'Fuji Electric', 'SINGLE', 2.5, 1, 3040)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG12KETA', 'Fuji Electric', 'SINGLE', 3.4, 1, 3090)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG14KETA', 'Fuji Electric', 'SINGLE', 4.2, 1, 4100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH07KGCG', 'Fuji Electric', 'SINGLE', 2, 1, 2920)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH09KGCG', 'Fuji Electric', 'SINGLE', 2.5, 1, 3500)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH12KGCG', 'Fuji Electric', 'SINGLE', 3.4, 1, 3650)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH14KGCG', 'Fuji Electric', 'SINGLE', 4.2, 1, 4670)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH07KMCG', 'Fuji Electric', 'SINGLE', 2, 1, 2100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH09KMCG', 'Fuji Electric', 'SINGLE', 2.5, 1, 2300)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH12KMCG', 'Fuji Electric', 'SINGLE', 3.4, 1, 2700)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH14KMCG', 'Fuji Electric', 'SINGLE', 4.2, 1, 3800)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG09KMCEN', 'Fuji Electric', 'SINGLE', 2.5, 1, 3300)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG12KMCEN', 'Fuji Electric', 'SINGLE', 3.4, 1, 3730)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG14KMCEN', 'Fuji Electric', 'SINGLE', 4.2, 1, 5330)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG18KMTA', 'Fuji Electric', 'SINGLE', 5.2, 1, 4360)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG24KMTA', 'Fuji Electric', 'SINGLE', 7.1, 1, 6280)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG30KMTA', 'Fuji Electric', 'SINGLE', 8, 1, 9050)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG36KMTA', 'Fuji Electric', 'SINGLE', 9.4, 1, 9800)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH07KNCA', 'Fuji Electric', 'SINGLE', 2, 1, 2400)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH09KNCA', 'Fuji Electric', 'SINGLE', 2.5, 1, 2500)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH12KNCA', 'Fuji Electric', 'SINGLE', 3.4, 1, 2600)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH07KLTA', 'Fuji Electric', 'SINGLE', 2, 1, 1900)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH09KLTA', 'Fuji Electric', 'SINGLE', 2.5, 1, 2200)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROH12KLTA', 'Fuji Electric', 'SINGLE', 3.4, 1, 2400)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG18KLCA', 'Fuji Electric', 'SINGLE', 5.2, 1, 4150)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG24KLCA', 'Fuji Electric', 'SINGLE', 7.1, 1, 5750)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG14KBTA2', 'Fuji Electric', 'MULTI', 4, 2, 6100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHG14KBTA2', 'GENERAL', 'MULTI', 4, 2, 6100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG18KBTA2', 'Fuji Electric', 'MULTI', 5, 2, 7100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHG18KBTA2', 'GENERAL', 'MULTI', 5, 2, 7100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG18KBTA3', 'Fuji Electric', 'MULTI', 5.4, 3, 9100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHG18KBTA3', 'GENERAL', 'MULTI', 5.4, 3, 9100)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG24KBTA3', 'Fuji Electric', 'MULTI', 6.8, 3, 9800)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHG24KBTA3', 'GENERAL', 'MULTI', 6.8, 3, 9800)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG30KBTA4', 'Fuji Electric', 'MULTI', 8, 4, 11800)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHG30KBTA4', 'GENERAL', 'MULTI', 8, 4, 11800)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('ROG36KBTA5', 'Fuji Electric', 'MULTI', 9.5, 5, 14700)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;
INSERT INTO public.outdoor_units (model_code, brand, type, cooling_capacity_kw, max_indoor_units, price_netto)
VALUES ('AOHG36KBTA5', 'GENERAL', 'MULTI', 9.5, 5, 14700)
ON CONFLICT (model_code) DO UPDATE SET 
    brand = EXCLUDED.brand,
    type = EXCLUDED.type,
    cooling_capacity_kw = EXCLUDED.cooling_capacity_kw,
    max_indoor_units = EXCLUDED.max_indoor_units,
    price_netto = EXCLUDED.price_netto;

-- 3. Insert Single Split Sets

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4500
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH07KJCAL' AND o.model_code = 'AOHH07KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4900
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH09KJCAL' AND o.model_code = 'AOHH09KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5500
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH12KJCAL' AND o.model_code = 'AOHH12KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 7300
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH14KJCAL' AND o.model_code = 'AOHH14KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4690
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH07KJCAL-B' AND o.model_code = 'AOHH07KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4900
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH09KJCAL-B' AND o.model_code = 'AOHH09KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5700
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH12KJCAL-B' AND o.model_code = 'AOHH12KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 7500
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'ASHH14KJCAL-B' AND o.model_code = 'AOHH14KJCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4570
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG07KETF' AND o.model_code = 'ROG07KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5260
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG09KETF' AND o.model_code = 'ROG09KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5630
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG12KETF' AND o.model_code = 'ROG12KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 7660
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG14KETF' AND o.model_code = 'ROG14KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4570
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG07KETF-B' AND o.model_code = 'ROG07KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5260
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG09KETF-B' AND o.model_code = 'ROG09KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5630
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG12KETF-B' AND o.model_code = 'ROG12KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 7660
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG14KETF-B' AND o.model_code = 'ROG14KETA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5200
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH07KGTG' AND o.model_code = 'ROH07KGCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5890
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH09KGTG' AND o.model_code = 'ROH09KGCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 6240
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH12KGTG' AND o.model_code = 'ROH12KGCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 8300
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH14KGTG' AND o.model_code = 'ROH14KGCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 3650
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH07KMCG' AND o.model_code = 'ROH07KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4200
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH09KMCG' AND o.model_code = 'ROH09KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4800
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH12KMCG' AND o.model_code = 'ROH12KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 6600
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH14KMCG' AND o.model_code = 'ROH14KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4050
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH07KMCG-B' AND o.model_code = 'ROH07KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4600
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH09KMCG-B' AND o.model_code = 'ROH09KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5200
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH12KMCG-B' AND o.model_code = 'ROH12KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 7000
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH14KMCG-B' AND o.model_code = 'ROH14KMCG'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5540
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG09KMCEN' AND o.model_code = 'ROG09KMCEN'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 6390
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG12KMCEN' AND o.model_code = 'ROG12KMCEN'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 8950
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG14KMCEN' AND o.model_code = 'ROG14KMCEN'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 5940
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG09KMCEN-B' AND o.model_code = 'ROG09KMCEN'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 6790
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG12KMCEN-B' AND o.model_code = 'ROG12KMCEN'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 9350
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG14KMCEN-B' AND o.model_code = 'ROG14KMCEN'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 8090
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG18KMTE' AND o.model_code = 'ROG18KMTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 10750
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG24KMTE' AND o.model_code = 'ROG24KMTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 15120
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG30KMTA' AND o.model_code = 'ROG30KMTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 16400
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG36KMTA' AND o.model_code = 'ROG36KMTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 3900
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH07KNCA' AND o.model_code = 'ROH07KNCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4100
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH09KNCA' AND o.model_code = 'ROH09KNCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4350
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH12KNCA' AND o.model_code = 'ROH12KNCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 3100
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH07KLTA' AND o.model_code = 'ROH07KLTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 3600
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH09KLTA' AND o.model_code = 'ROH09KLTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 4100
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSH12KLTA' AND o.model_code = 'ROH12KLTA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 7030
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG18KLCA' AND o.model_code = 'ROG18KLCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

INSERT INTO public.single_split_sets (indoor_unit_id, outdoor_unit_id, set_price_netto)
SELECT i.id, o.id, 9580
FROM public.indoor_units i, public.outdoor_units o
WHERE i.model_code = 'RSG24KLCA' AND o.model_code = 'ROG24KLCA'
ON CONFLICT ON CONSTRAINT single_split_sets_indoor_unit_id_outdoor_unit_id_key DO UPDATE SET
    set_price_netto = EXCLUDED.set_price_netto;

-- 4. Insert Multi Split Sets

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG14KBTA2)', o.id, 2, '[{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG14KBTA2)', o.id, 2, '[{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG14KBTA2)', o.id, 2, '[{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG14KBTA2)', o.id, 2, '[{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG14KBTA2)', o.id, 2, '[{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG14KBTA2)', o.id, 2, '[{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG14KBTA2)', o.id, 2, '[{"code":"07"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG14KBTA2)', o.id, 2, '[{"code":"07"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG14KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG18KBTA2)', o.id, 2, '[{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG18KBTA2)', o.id, 2, '[{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG18KBTA2)', o.id, 2, '[{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG18KBTA2)', o.id, 2, '[{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG18KBTA2)', o.id, 2, '[{"code":"07"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG18KBTA2)', o.id, 2, '[{"code":"07"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG18KBTA2)', o.id, 2, '[{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG18KBTA2)', o.id, 2, '[{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG18KBTA2)', o.id, 2, '[{"code":"09"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG18KBTA2)', o.id, 2, '[{"code":"09"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (AOHG18KBTA2)', o.id, 2, '[{"code":"12"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 2-pokojowy (ROG18KBTA2)', o.id, 2, '[{"code":"12"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA2';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG18KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG18KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG18KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG18KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG18KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG18KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"07"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"09"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"07"},{"code":"09"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"09"},{"code":"09"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"09"},{"code":"09"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (AOHG24KBTA3)', o.id, 3, '[{"code":"09"},{"code":"12"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 3-pokojowy (ROG24KBTA3)', o.id, 3, '[{"code":"09"},{"code":"12"},{"code":"12"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG24KBTA3';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (AOHG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (ROG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (AOHG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (ROG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (AOHG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"07"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (ROG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"07"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (AOHG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (ROG30KBTA4)', o.id, 4, '[{"code":"07"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (AOHG30KBTA4)', o.id, 4, '[{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 4-pokojowy (ROG30KBTA4)', o.id, 4, '[{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG30KBTA4';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (AOHG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (ROG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (AOHG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (ROG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"07"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (AOHG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (ROG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"07"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (AOHG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (ROG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"07"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (AOHG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (ROG36KBTA5)', o.id, 5, '[{"code":"07"},{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (AOHG36KBTA5)', o.id, 5, '[{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'AOHG36KBTA5';

INSERT INTO public.multi_split_sets (name, outdoor_unit_id, supported_rooms_count, indoor_units_json, set_price_netto)
SELECT 'Zestaw 5-pokojowy (ROG36KBTA5)', o.id, 5, '[{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"},{"code":"09"}]'::jsonb, NULL
FROM public.outdoor_units o
WHERE o.model_code = 'ROG36KBTA5';
