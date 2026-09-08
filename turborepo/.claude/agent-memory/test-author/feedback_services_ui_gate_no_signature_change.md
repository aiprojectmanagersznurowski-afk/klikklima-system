---
name: feedback_services_ui_gate_no_signature_change
description: When a delete-gate helper already has a GREEN test tied to a different requirement, add a second independent gate variable in the client instead of widening the helper's signature
metadata:
  type: feedback
---

For `CRM-DELETE-ADMIN-ONLY-SERVICES`, `services/menu-visibility.ts::isDeleteMenuItemVisible(service)`
already had a GREEN, single-arg test owned by a *different* requirement
(`services-source-of-truth.test.ts` AC9, `@REQ: SRV-SOURCE-OF-TRUTH`). The WO explicitly offered
two architectures (widen the helper's signature to take `actorRole`, or add a second independent
`canDeleteServices` check in the client component). Chose the second: `grep -rn
"isDeleteMenuItemVisible"` first to confirm the single call site, then left the helper untouched
and added `canDeleteServices = !!actorRole && can(actorRole,'services','delete')==='yes'` in
`services-client.tsx`, combining it with the existing `isDeleteMenuItemVisible(service) &&` gate.

**Why:** widening the helper's signature would force editing (or breaking) the already-GREEN
`AC9` test tied to `SRV-SOURCE-OF-TRUTH` — that helper's job is "is this row a real service",
not "can this role delete". Conflating the two would smell like scope creep across two
unrelated requirements. The two-gate pattern also matches the existing convention in
`incidents-client.tsx`/`installations-client.tsx` (`canDeleteX` computed inline in the client),
so `services` stays consistent with three of its four siblings instead of inventing a fourth shape.

**How to apply:** before choosing to widen a shared helper's signature, check whether it already
has a GREEN test under a *different* `@REQ` tag. If so, prefer adding an independent boolean/gate
next to it rather than changing its contract. Verified mutation-safe: a scratch copy with the
`canDeleteServices` computed but NOT anded into the gate (`isDeleteMenuItemVisible(service) &&
(...)` unchanged) kills exactly one assertion (the "gate contains both conditions" check),
leaving the other 5 green — proof the assertion isolates this specific regression, not the
whole file's existence.

Related: [[feedback_three_layer_coverage_closure]], [[feedback_incidents_auditors_parity_closure]].
