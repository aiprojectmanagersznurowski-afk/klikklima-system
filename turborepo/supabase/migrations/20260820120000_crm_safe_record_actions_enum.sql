-- WO: CRM-SAFE-RECORD-ACTIONS — Z1
-- Dodanie stanu terminalnego ARCHIVED_LOST do enuma statusów leada.
--
-- DLACZEGO OSOBNY PLIK: ALTER TYPE ... ADD VALUE dodaje wartość, której NIE WOLNO użyć
-- w tej samej transakcji, w której powstała (PostgreSQL). Migracja danych i nowe kolumny
-- (Z2-Z5) siedzą w kolejnym pliku, żeby nikt przy następnej edycji nie dopisał tu
-- UPDATE ... SET status = 'ARCHIVED_LOST' i nie wywrócił wdrożenia.
--
-- Zmiana ADDYTYWNA: rozszerzenie enuma, żadna istniejąca wartość nie znika.
-- IF NOT EXISTS zapewnia idempotencję przy powtórnym przebiegu.

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED_LOST';
