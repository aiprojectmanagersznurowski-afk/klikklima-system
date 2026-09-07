---
name: project_klikklima_wo_conventions
description: Konwencje i wzorce Work Orderów w projekcie KlikKlima — gdzie szukać precedensów, jak routować role
metadata:
  type: project
---

Work Ordery żyją w `docs/workorders/<REQ-ID>.md`, wzorem `SEC-LAST-ADMIN-GUARD.md`. Struktura: Status na górze (z jasnym wskazaniem, czy jest punkt WYMAGA DECYZJI blokujący RED), Wymagania (linki do sąsiednich ID w rejestrze, z jasnym rozstrzygnięciem "nie zależy/nie zamyka"), Kontekst kodu (Istnieje/Brakuje, cytaty linii), Zmiana kontraktu, WYMAGA DECYZJI jako osobna sekcja (nie chowana w Ryzykach), Kryteria akceptacji rozwinięte 1:1 z AC z `requirements.contract.mjs`, Przypadki brzegowe, Poza zakresem, Ryzyka i nieznane, zamknięcie "Kolejność ról".

**Why:** Test-author i contract-steward czytają WO bez dodatkowych pytań — precyzja cytatów linii i jawne AC pozwala im działać bez doprecyzowania.

**How to apply:** Przy każdym nowym WO sprawdzić `contracts/requirements.contract.mjs` dla pełnego `source`/`statement`/`acceptance`, oraz istniejące migracje w `supabase/migrations/` dla wzorców składni CHECK/CONSTRAINT (np. `audit_log_operation_check` w `20260901220000_rodo_audit_log_and_client_anonymization.sql:72-92` — nazwana `CONSTRAINT <tabela>_<kolumna>_check CHECK (kolumna IN (...))`, licząca wartości ze słownika w `contracts/*.mjs`).

Jeżeli WO dotyka `schema.prisma` lub `supabase/migrations/`, jawnie napisać w sekcji "Zmiana kontraktu", że implementacja wymaga osobnego okna kontraktowego i roli `contract-steward`, NIE `implementer-server` — te ścieżki są zablokowane hookiem poza takim oknem, i pomylenie roli w planowaniu kosztuje cofnięcie kroku.

Rejestr ROLES w `contracts/rbac.contract.mjs:9` (obecnie `['admin', 'dyspozytor', 'audytor', 'monter']`) i RESOURCES tamże — cytować aktualną wartość w WO, nie zakładać z pamięci, bo lista RESOURCES rosła (ADR-012, FLD-AVAILABILITY-SPLIT, FLD-CONSENT-DOCS).
