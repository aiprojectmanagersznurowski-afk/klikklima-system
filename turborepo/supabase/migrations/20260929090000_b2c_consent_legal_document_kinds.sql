-- ============================================================================
-- B2C-CONSENT-RODO — Z1: rodzaje dokumentów prawnych KLIENTA B2C
-- WYMAGANIE: B2C-CONSENT-RODO (contracts/requirements.contract.mjs)
-- WO: docs/workorders/B2C-CONSENT-RODO.md — D-C1 = (b), decyzja Michała 2026-09-28:
--     dwie osobne zgody (polityka prywatności + regulamin serwisu), dwie wersje.
--
-- STAN: URUCHOMIONA na żywej bazie 2026-09-29 w oknie KK-B2C-CONSENT-RODO i sprawdzona
--       w pg_enum (RODO_CONSENT, EMPLOYEE_TERMS, B2C_PRIVACY_POLICY, B2C_TERMS).
--
-- DLACZEGO OSOBNY PLIK: ALTER TYPE ... ADD VALUE dodaje wartość, której NIE WOLNO użyć
-- w tej samej transakcji, w której powstała. Kolumny zgody na `leady` (20260929091000) tych
-- wartości nie używają, ale następna osoba, która dopisze tu INSERT wersji B2C_*, wywróciłaby
-- wdrożenie — stąd wzorzec 20260820120000: w tym pliku NIC poza ADD VALUE.
--
-- DLACZEGO NOWE WARTOŚCI, a nie RODO_CONSENT: RODO_CONSENT jest zgodą RODO PRACOWNIKA
-- (FLD-CONSENT-DOCS). Użycie jej dla klienta miesza dwa rejestry (ryzyko R-2 w WO).
--
-- UWAGA DLA KONSUMENTÓW: getActorConsentsStatus() czyta wszystkie wersje is_current bez filtra
-- rodzaju. Po opublikowaniu pierwszej wersji B2C_* pracownik byłby blokowany zgodą kliencką,
-- dopóki ten odczyt nie zostanie zawężony do rodzajów pracowniczych. Sama migracja niczego nie
-- psuje (0 wersji w rejestrze) — ryzyko rodzi dopiero publikacja.
--
-- Zmiana ADDYTYWNA: żadna istniejąca wartość nie znika. IF NOT EXISTS = idempotencja.
-- ============================================================================

ALTER TYPE "LegalDocumentKind" ADD VALUE IF NOT EXISTS 'B2C_PRIVACY_POLICY';
ALTER TYPE "LegalDocumentKind" ADD VALUE IF NOT EXISTS 'B2C_TERMS';
