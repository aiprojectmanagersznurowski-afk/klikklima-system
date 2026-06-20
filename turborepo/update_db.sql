-- 1. Dodanie nowych kolumn do indoor_units
ALTER TABLE indoor_units 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'Biały',
ADD COLUMN IF NOT EXISTS recommended_area_m2 INTEGER;

-- 2. Czyszczenie starych danych (zostaną zastąpione przez fuji_seed.sql)
DELETE FROM single_split_sets;
DELETE FROM multi_split_sets;
DELETE FROM indoor_units;
DELETE FROM outdoor_units;

-- Teraz możesz odpalić zawartość pliku `fuji_seed.sql` aby zaimportować nowe zaktualizowane dane zestawów.
