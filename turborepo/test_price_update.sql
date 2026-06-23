-- Zapytanie SQL do wklejenia w panelu Supabase (SQL Editor)
-- Poniższy skrypt ujednolici testowo ceny wszystkich jednostek w systemie:
-- Wszędzie wpisze 1000 PLN dla urządzeń bazowych i wyzeruje "Ceny Pakietowe" zestawów.

-- 1. Ustawienie sztywnej ceny 1000 PLN dla jednostek wewnętrznych
UPDATE indoor_units 
SET price_netto = 1000;

-- 2. Ustawienie sztywnej ceny 1000 PLN dla jednostek zewnętrznych (agregatów)
UPDATE outdoor_units 
SET price_netto = 1000;

-- 3. Wyzerowanie "Override'u" w zestawach (od teraz system sam będzie dodawał 1000 + 1000 = 2000 PLN za komplet)
UPDATE single_split_sets 
SET set_price_netto = 0;

UPDATE multi_split_sets 
SET set_price_netto = 0;
