---
name: audit-log-live-state
description: audit_log istnieje na żywej bazie (tabela, CHECK-i, trigger) — rejestr wymagań był nieaktualny, POPRAWIONY 2026-09-03
metadata:
  type: project
---

Tabela `audit_log` (kolumny `id, actor_email, actor_role, operation, resource, record_id, justification, legal_basis, created_at`), trzy CHECK-i (`operation`, `resource` — 13 wartości RESOURCES **bez** `logistics`, `legal_basis` — 5 wartości, `justification` >= 10 znaków po `btrim`) oraz trigger `audit_log_append_only_trg` **są zastosowane na żywej bazie** (weryfikacja 2026-09-03). Kolumny `before_snapshot` nie ma i nie ma być (rozstrzygnięcie człowieka).

**AKTUALIZACJA 2026-09-03 (ta sama tura):** `contracts/requirements.contract.mjs` przy `CRM-CLIENT-ANONYMIZE-RODO` i `SEC-AUDIT-LOG-APPEND-ONLY` twierdziło, że migracja `20260901220000` nie została uruchomiona — to zostało **naprawione** przez `contract-steward` w oknie kontraktowym `SEC-AUDIT-LOG-DELETE`, `source` obu wpisów teraz odzwierciedla stan faktyczny. Ta notatka opisuje już wykonaną korektę, nie otwarte zadanie.

**Why:** Nieaktualny zapis w rejestrze wprowadzał w błąd przy ocenie, czy druga linia obrony (CHECK-i w bazie) w ogóle działa.

**How to apply:** Oceniając akcje `delete`/`anonymize`, traktuj CHECK-i bazy jako realnie działającą drugą linię (np. `resource: 'logistics'` zostanie odrzucone przez bazę). Rejestr wymagań jest teraz zgodny ze stanem bazy w tym punkcie — ale ogólna zasada zostaje: przy kolejnych ocenach zawsze weryfikuj `source` względem żywej bazy, nie ufaj mu ślepo (patrz [[migration-ledger-unreliable]] w pamięci `spec-analyst`). Patrz [[audit-reporting-style]].
