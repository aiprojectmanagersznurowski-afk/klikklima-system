---
name: audit-log-live-state
description: audit_log ISTNIEJE na żywej bazie mimo że rejestr wymagań twierdzi inaczej; legalBases ma już neutralne wartości; rozbicie SEC-AUDIT-LOG na cztery WO
metadata:
  type: project
---

Sonda na żywej bazie (2026-09-03) pokazała, że tabela `audit_log` **jest zastosowana**: kolumny `id, actor_email, actor_role, operation, resource, record_id, justification, legal_basis, created_at`, trzy CHECK-i (`operation` 6 wartości, `resource` 13 wartości RESOURCES, `legal_basis` 5 wartości, `justification` btrim >= 10) oraz wyzwalacz `audit_log_append_only_trg`. **Nie ma** kolumny `before_snapshot` — zgodnie z [[sprzecznosc-before-snapshot-rodo]]. Tabela ma 0 wierszy.

**Why:** Wpisy `CRM-CLIENT-ANONYMIZE-RODO` i `SEC-AUDIT-LOG-APPEND-ONLY` w `contracts/requirements.contract.mjs` twierdzą w polu `source`, że migracja `20260901220000` „NIE uruchomiona na żywej bazie”, a `SEC-AUDIT-LOG-APPEND-ONLY` ma nawet kryterium „nieweryfikowalne — brak Postgresa”. To jest nieprawda i blokowałoby planowanie na fałszywej przesłance. Kolejny przypadek [[migration-ledger-unreliable]], tylko w drugą stronę: tu ewidencja jest zbyt pesymistyczna.

**How to apply:** Planując cokolwiek audytowego, nie ufaj polu `source` — odpal sondę wg [[db-probe-recipe]]. `AUDIT_REQUIREMENTS.legalBases` **już zawiera** neutralne `OPERATIONAL_ERROR` i `OTHER`, więc audyt operacji spoza RODO **nie wymaga** rozszerzania słownika ani migracji CHECK-a.

Rozbicie `SEC-AUDIT-LOG` (rodzic zostaje TODO, wzorem `CRM-DELETE-ADMIN-ONLY`) na cztery WO: DELETE (napisane: `docs/workorders/SEC-AUDIT-LOG-DELETE.md`), ROLE-CHANGE, MANUAL-STATUS, UI-JUSTIFICATION.

Pułapka mapowania: `deleteLogisticsOrderAction` **deleguje** do `deleteLeadAction`, a `RESOURCES` nie ma wartości `logistics` — logistyka loguje się jako `resource='leads'`. Osiem akcji `delete` to tylko **siedem** punktów zapisu.
