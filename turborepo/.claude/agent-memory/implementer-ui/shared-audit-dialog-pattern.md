---
name: shared-audit-dialog-pattern
description: How to build new audit dialogs (justification + legal basis + extra field) by copying DeleteJustificationDialog, and how page-level RBAC tests interact with new client props
metadata:
  type: project
---

`apps/b2b-web/src/components/delete-justification-dialog.tsx` is the canonical pattern for any
form that needs an audit trail (justification textarea, min length, `legalBasis` select sourced
from `AUDIT_REQUIREMENTS.legalBases`). New audit actions (e.g. `SEC-AUDIT-LOG-ROLE-CHANGE`) should
extend the shared Zod schema (`deleteJustificationSchema.extend({...})` in
`src/lib/audit/*-schema.ts`) rather than duplicating the justification/legalBasis fields, and copy
the dialog's markup/structure for the new field (see
`apps/b2b-web/src/app/(dashboard)/settings/role-change-dialog.tsx` for the role-change variant with
an added `role` `<select>`).

**Why:** Keeps the 10-char justification threshold and legal-basis dictionary in exactly one place;
avoids a second parallel list that could drift from the contract (explicitly forbidden by
`sec-audit-log-delete-static.test.ts`).

**How to apply:** When asked to add a new audit-trailed action, look first for an existing
`*-justification-schema.ts` to extend, and for `DeleteJustificationDialog` as the UI template
(same fixed `rounded-2xl` modal shell, `role="alert"` error paragraph, disabled-until-valid submit
button).

Also: Server Component RBAC tests in this repo (e.g. `settings-page-authz.test.ts`) assert
`result` via `toMatchObject({ props: { users: FIXTURE } })` — `toMatchObject` only checks a subset,
so adding a new prop (like `actorRole`) to the client component and passing it from the page is
safe and won't break these tests, no need to ask permission before extending props this way.
