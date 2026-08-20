-- WO: FLD-GEO-COORDS — Z1
-- Field App, faza 0: geofencing (promień odblokowania pracy, promień alertu SMS) wymaga
-- współrzędnych punktu docelowego wizyty. Dziś Google Places je zwraca, a insert do adresu
-- je gubi — każdy nowy lead to adres do ponownego, odpłatnego geokodowania.
--
-- Zmiana addytywna i idempotentna. Zero NOT NULL bez wartości domyślnej na istniejącej tabeli.
-- NIE URUCHAMIANA na żadnej bazie w ramach tego ticketu.
--
-- Typ: DOUBLE PRECISION (~15 cyfr znaczących, czyli błąd poniżej milimetra dla stopni WGS84).
-- Świadomie NIE numeric(9,6): wartości wchodzą wyłącznie do obliczeń odległości (Haversine,
-- docelowo PostGIS ST_Distance), gdzie i tak następuje konwersja do double. numeric ma przewagę
-- przy porównaniach na równość i przy sumowaniu kwot — tu nie zachodzi ani jedno, ani drugie,
-- a każde takie porównanie na współrzędnych byłoby błędem projektowym samym w sobie.
-- Ewentualna późniejsza migracja do geography(Point,4326) czyta te kolumny bez zaokrągleń.
--
-- Oba pola nullable świadomie: adresy sprzed tej migracji nie mają geokodowania, a adres wpisany
-- ręcznie w panelu B2B może nigdy go nie dostać. Obsługa NULL (brak geofencingu, odblokowanie
-- pracy decyzją dyspozytora) należy do Field App, nie do bazy.
--
-- Bez CHECK na zakres w tej turze — uzasadnienie i rekomendacja w raporcie FLD-GEO-COORDS.

ALTER TABLE public.adresy
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.adresy.latitude IS
  'Szerokosc geograficzna WGS84 (EPSG:4326), stopnie dziesietne, zakres -90..90. Zrodlo: geokodowanie Google Places w kroku rezerwacji B2C. NULL = adres niezgeokodowany.';
COMMENT ON COLUMN public.adresy.longitude IS
  'Dlugosc geograficzna WGS84 (EPSG:4326), stopnie dziesietne, zakres -180..180. Zrodlo: geokodowanie Google Places w kroku rezerwacji B2C. NULL = adres niezgeokodowany.';
