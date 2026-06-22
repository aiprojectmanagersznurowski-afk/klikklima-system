-- 1. Dodanie/usunięcie nowych kolumn z indoor_units
ALTER TABLE indoor_units 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'Biały',
ADD COLUMN IF NOT EXISTS recommended_area_m2 INTEGER,
DROP COLUMN IF EXISTS is_bestseller;

-- 1b. Dodanie is_bestseller do zestawów
ALTER TABLE single_split_sets ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;
ALTER TABLE multi_split_sets ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false;

-- 2. Czyszczenie starych danych (zostaną zastąpione przez fuji_seed.sql)
DELETE FROM single_split_sets;
DELETE FROM multi_split_sets;
DELETE FROM indoor_units;
DELETE FROM outdoor_units;

-- Teraz możesz odpalić zawartość pliku `fuji_seed.sql` aby zaimportować nowe zaktualizowane dane zestawów.

-- Oznaczenie przykładowych zestawów jako bestsellery do testów (Fuji KJCAL i KLCA)
UPDATE single_split_sets 
SET is_bestseller = true 
WHERE indoor_unit_id IN (
    SELECT id FROM indoor_units WHERE series_name IN ('KJCAL', 'KLCA') LIMIT 4
);
