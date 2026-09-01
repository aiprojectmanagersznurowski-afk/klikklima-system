-- ============================================================================
-- LOGISTICS-SHIPPING-EFFECTS — Faza A
-- Wymaganie: FNL-ROLLBACK (kryterium „SLA logistyczne zostaje wstrzymane")
-- Decyzja projektowa: WO LOGISTICS-SHIPPING-EFFECTS, D2 (suspendLogisticsSla)
--
-- STATUS: NIE URUCHOMIONA NA ŻYWEJ BAZIE.
-- Uruchomienie wymaga osobnej, jawnej zgody człowieka (precedens z incydentu
-- 1/4 tej sesji — plik w repozytorium dowodzi intencji, nie stanu serwera).
--
-- Zmiana ADDYTYWNA: kolumna nullable, bez wartości domyślnej, bez NOT NULL.
-- Backfill nie jest potrzebny — NULL ma znaczenie domenowe „zegar nie jest
-- wstrzymany", czyli poprawny stan każdego istniejącego wiersza.
-- Nie nakładamy ograniczenia NOT NULL ani teraz, ani później: kolumna z natury
-- jest opcjonalna.
--
-- Nazewnictwo (ADR-002): kolumna po angielsku, snake_case, sufiks _at = moment.
-- Tabela docelowa ma nazwę porzuconą (`leady`) — odwołanie do ISTNIEJĄCEGO
-- obiektu, zamrożony dług KK-NAMING-BASELINE, nie nowa polska nazwa.
-- ============================================================================

ALTER TABLE public.leady
  ADD COLUMN IF NOT EXISTS logistics_sla_paused_at timestamptz;

COMMENT ON COLUMN public.leady.logistics_sla_paused_at IS
  'FNL-ROLLBACK: moment wstrzymania zegara SLA logistycznego przy rollbacku (T10-T13). NULL = zegar biezacy. Stempel ustawiany tylko gdy byl NULL - powtorny rollback go nie przesuwa. Wznowienie nalezy do FNL-ROLLBACK-EXIT.';
