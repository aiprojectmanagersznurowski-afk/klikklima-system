---
name: project-crews-admin-gates-closed
description: CRM-DELETE-ADMIN-ONLY-CREWS and CRM-CREW-UPDATE-ADMIN-ONLY closed 2026-09-07, three-vs-two-layer distinction
metadata:
  type: project
---

Both `CRM-DELETE-ADMIN-ONLY-CREWS` and `CRM-CREW-UPDATE-ADMIN-ONLY` in
`contracts/requirements.contract.mjs` moved TODO → DONE on 2026-09-07.

- `CRM-DELETE-ADMIN-ONLY-CREWS`: requires 3 independent layers (UI, Server Action,
  RLS). Closed by commit `adae428` (UI: `canDeleteCrews` gate in crews-client.tsx) +
  `11c4f83` (new static test `crews-rls-deny-by-default.test.ts` freezing
  `ENABLE ROW LEVEL SECURITY` + zero `CREATE POLICY` on `zespoly_monterskie` in the
  baseline migration). Server Action layer was already covered by
  `crews-admin-gates.test.ts`.
- `CRM-CREW-UPDATE-ADMIN-ONLY`: deliberately has NO RLS acceptance criterion (its
  acceptance array states the UI-hiding layer is separate but never mentions RLS) —
  only 2 layers (UI + Server Action), both closed by `adae428` and pre-existing
  `updateCrewAvatar` gate (`can(actorRole,"crews","update") !== "yes"` in
  `apps/b2b-web/src/app/(dashboard)/crews/actions.ts`).

**Why it matters:** don't assume every admin-only requirement in this contract needs
all 3 layers — read the full `acceptance` array before treating "RLS test missing" as
a blocker. `CRM-CREW-UPDATE-ADMIN-ONLY`'s AC also has an unfalsifiable clause (AC #3,
`can(...) !== 'no'` vs `=== 'yes'` distinction for a future `:own` variant that
doesn't exist yet in the RBAC matrix) — test file documents this explicitly as an
acknowledged gap rather than skipping it silently; production code already uses the
stricter `!== 'yes'` form so the requirement is satisfied in practice even without a
test that can observe the difference.

**How to apply:** when asked to close a requirement, verify AC coverage against the
literal acceptance array text, not against an assumed template (e.g. "delete = 3
layers, update = 3 layers") — this contract deliberately varies AC shape per
requirement, and scope-boundary bullets ("X jest poza zakresem", "Y NIE należy do
tego wymagania") are statements, not additional testable criteria blocking DONE.

Related: test file for both is `apps/b2b-web/tests/crews-admin-gates.test.ts`, whose
`@REQ` tags still point to the now-`SUPERSEDED` parent `CRM-DELETE-ADMIN-ONLY` for the
delete side rather than the child `-CREWS` ID — pre-existing stale tag, not touched in
this session, see [[project_superseded_status_semantics]].
