---
name: feedback-cross-batch-consistency-checks
description: When reviewing multi-batch/parallel-agent work in this repo, verify consistency by grepping the same pattern across all touched files side-by-side, not by reading each diff in isolation
metadata:
  type: feedback
---

For batches explicitly framed as "make N views consistent" (e.g. a UI audit rolled out per-view by parallel
sub-agents), the highest-value review technique is not deep-reading each file's diff alone, but grepping the exact
CSS/logic pattern that's supposed to be shared (e.g. `sticky right-0 z-\d+`, click-guard `window.getSelection()`
logic, a new shared constant like `EMPTY_VALUE`) across every file that should have adopted it, then diffing the
matches for outliers.

**Why:** in the 2026-09-03 apps/b2b-web review, this caught two real regressions that a per-file read missed at
first pass: `customers-client.tsx` used `sticky top-0 z-10` for its table header while every other table
(`leads`, `installations`, `logistics`) used `z-30` — introduced by this exact batch, invisible unless compared
side by side. Also caught a leftover bare `"-"` literal in `leads-client.tsx` sitting a few lines away from correct
`EMPTY_VALUE` usage in the same file.

**How to apply:** for any review request that mentions "batch", "tura", "audyt spójności", or parallel per-view
work, run targeted `grep -rn` for the shared pattern(s) across the whole feature area before writing the verdict.
Treat a single-file read as insufficient evidence of consistency even if that file's tsc/vitest pass. See
[[project_ui_consistency_audit_b2b]].
