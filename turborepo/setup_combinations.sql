-- Usuwamy widok i funkcje, jeśli istnieją
DROP MATERIALIZED VIEW IF EXISTS public.available_combinations CASCADE;

-- 1. Funkcja pomocnicza do tworzenia posortowanego stringa z kodów JSON (np. 09-12-18)
CREATE OR REPLACE FUNCTION public.get_codes_hash(indoor_json JSONB) 
RETURNS TEXT AS $$
DECLARE
    hash TEXT;
BEGIN
    SELECT string_agg(elem->>'code', '-' ORDER BY elem->>'code')
    INTO hash
    FROM jsonb_array_elements(indoor_json) AS elem;
    
    RETURN hash;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Funkcja do obliczania ceny multi split z najtańszych dostępnych jednostek
CREATE OR REPLACE FUNCTION public.get_multi_indoor_price(series_param TEXT, indoor_json JSONB) 
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC := 0;
    elem JSONB;
    min_price NUMERIC;
BEGIN
    FOR elem IN SELECT * FROM jsonb_array_elements(indoor_json)
    LOOP
        SELECT MIN(price_netto) INTO min_price
        FROM public.indoor_units 
        WHERE series_name = series_param 
          AND model_code LIKE '%' || (elem->>'code') || '%';
          
        total := total + COALESCE(min_price, 0);
    END LOOP;
    RETURN total;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Tworzymy nowy Materialized View
CREATE MATERIALIZED VIEW public.available_combinations AS

-- A. SINGLE SPLIT (1 Pokój)
SELECT 
    'SINGLE' as type,
    iu.series_name,
    ou.brand,
    1 as room_count,
    -- Wyciągamy pierwsze dwie cyfry z kodu (np. '09') jako hash
    SUBSTRING(iu.model_code FROM '[0-9]{2}') as sizes_hash,
    ou.id as outdoor_unit_id,
    ou.model_code as outdoor_model,
    iu.model_code as indoor_model,
    ou.cooling_capacity_kw as outdoor_capacity,
    CASE 
        WHEN sss.set_price_netto > 0 THEN sss.set_price_netto
        ELSE COALESCE(iu.price_netto, 0) + COALESCE(ou.price_netto, 0)
    END as total_devices_price,
    true as is_available
FROM public.single_split_sets sss
JOIN public.indoor_units iu ON iu.id = sss.indoor_unit_id
JOIN public.outdoor_units ou ON ou.id = sss.outdoor_unit_id
WHERE iu.is_single_compatible = true

UNION ALL

-- B. MULTI SPLIT (2 do 5 Pokoi)
SELECT 
    'MULTI' as type,
    iu.series_name,
    ou.brand,
    mss.supported_rooms_count as room_count,
    public.get_codes_hash(mss.indoor_units_json) as sizes_hash,
    ou.id as outdoor_unit_id,
    ou.model_code as outdoor_model,
    iu.model_code as indoor_model,
    ou.cooling_capacity_kw as outdoor_capacity,
    CASE 
        WHEN mss.set_price_netto > 0 THEN mss.set_price_netto
        ELSE public.get_multi_indoor_price(iu.series_name, mss.indoor_units_json) + COALESCE(ou.price_netto, 0)
    END as total_devices_price,
    true as is_available
FROM public.multi_split_sets mss
JOIN public.outdoor_units ou ON ou.id = mss.outdoor_unit_id
JOIN public.indoor_units iu ON iu.brand = ou.brand AND iu.is_multi_compatible = true
GROUP BY 
    iu.series_name, ou.brand, mss.supported_rooms_count, mss.indoor_units_json, 
    ou.id, ou.model_code, iu.model_code, ou.cooling_capacity_kw, mss.set_price_netto, ou.price_netto
;

-- 4. Indeksy dla bardzo szybkiego wyszukiwania w API:
CREATE INDEX idx_available_combinations_hash ON public.available_combinations(sizes_hash);
CREATE INDEX idx_available_combinations_series ON public.available_combinations(series_name);
CREATE INDEX idx_available_combinations_rooms ON public.available_combinations(room_count);

-- 5. Funkcja i Triggery do odświeżania
CREATE OR REPLACE FUNCTION public.refresh_available_combinations()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.available_combinations;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS refresh_combinations_on_outdoor ON public.outdoor_units;
CREATE TRIGGER refresh_combinations_on_outdoor
AFTER INSERT OR UPDATE OR DELETE ON public.outdoor_units
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();

DROP TRIGGER IF EXISTS refresh_combinations_on_indoor ON public.indoor_units;
CREATE TRIGGER refresh_combinations_on_indoor
AFTER INSERT OR UPDATE OR DELETE ON public.indoor_units
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();

DROP TRIGGER IF EXISTS refresh_combinations_on_multi ON public.multi_split_sets;
CREATE TRIGGER refresh_combinations_on_multi
AFTER INSERT OR UPDATE OR DELETE ON public.multi_split_sets
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();

DROP TRIGGER IF EXISTS refresh_combinations_on_single ON public.single_split_sets;
CREATE TRIGGER refresh_combinations_on_single
AFTER INSERT OR UPDATE OR DELETE ON public.single_split_sets
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_available_combinations();
