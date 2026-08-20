-- WO: CRM-SAFE-RECORD-ACTIONS — Z2, Z3, Z4, Z5
-- Wszystkie kolumny addytywne. Zero NOT NULL bez wartości domyślnej na istniejącej tabeli.
-- Docelowa lokalizacja: supabase/migrations/20260820120100_crm_safe_record_actions_columns.sql
-- Plik przygotowany poza repo — patrz RULE-CHALLENGE w raporcie (guard-forbidden / adr002-pl-tables).

-- Z2 (D1): blokada konta audytora. NOT NULL dopuszczalne, bo z wartością domyślną.
ALTER TABLE public.audytorzy
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Z3 (D3): moment wystawienia wyceny — zegar progu SLA.COLD_LEAD_REPRICE_DAYS.
-- Nullable świadomie: dla istniejących rekordów moment wyceny jest nieznany i NIE zgadujemy go
-- z updated_at. Obsługa NULL (brak wyceny) należy do Server Action, patrz przypadek brzegowy 7 w WO.
ALTER TABLE public.leady
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ;

-- Z4 (D4): znacznik automatu 14-dniowego wyprowadzony z lost_reason.
ALTER TABLE public.leady
  ADD COLUMN IF NOT EXISTS auto_rejected_reason TEXT;

-- Z5 (D5): notatka obowiązkowa dla lost_reason = 'OTHER'.
-- Obowiązkowość waliduje Server Action — kolumna zostaje nullable, bo dotyczy jednej wartości słownika.
ALTER TABLE public.leady
  ADD COLUMN IF NOT EXISTS lost_reason_note TEXT;

-- Z4 — MIGRACJA DANYCH. Rozdzielenie dwóch semantyk, które dzieliły jedną kolumnę.
-- Idempotentne: po przebiegu warunek WHERE nie łapie już żadnego wiersza.
-- Kolejność w jednym UPDATE jest istotna — czyszczenie lost_reason osobnym zapytaniem
-- skasowałoby dane, gdyby przebieg przerwał się między zapytaniami.
UPDATE public.leady
   SET auto_rejected_reason = lost_reason,
       lost_reason          = NULL
 WHERE lost_reason = 'AUTO_REJECT_14_DAYS';

COMMENT ON COLUMN public.leady.lost_reason IS
  'Wylacznie wartosc ze slownika LOST_REASONS (contracts/funnel.contract.mjs). Znacznik automatu: auto_rejected_reason.';
COMMENT ON COLUMN public.leady.auto_rejected_reason IS
  'Techniczny znacznik automatu, np. AUTO_REJECT_14_DAYS. Nie zasila statystyki powodow utraty (AC4.8).';
COMMENT ON COLUMN public.leady.quoted_at IS
  'Moment wystawienia wyceny. Zegar SLA.COLD_LEAD_REPRICE_DAYS (D3).';
COMMENT ON COLUMN public.audytorzy.is_active IS
  'false = konto zablokowane: brak dostepu do Field App i brak w puli wyboru audytora (D1).';
